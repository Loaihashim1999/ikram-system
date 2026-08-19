<?php

namespace App\Http\Controllers;

use App\Models\Staff;
use App\Models\StaffDependent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use PhpOffice\PhpSpreadsheet\IOFactory;

class StaffController extends Controller
{
    // ─── Index ───────────────────────────────────────────────────────────────

    public function index(Request $request): JsonResponse
    {
        $query = Staff::with(['dependents', 'distributions.basket'])->withCount('distributions');

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }
        if ($request->filled('search')) {
            $s = $request->search;
            $query->where(fn ($q) => $q->where('name', 'like', "%{$s}%")
                ->orWhere('national_id', 'like', "%{$s}%")
            );
        }

        return response()->json(['data' => $query->latest()->paginate(20)]);
    }

    // ─── Store ───────────────────────────────────────────────────────────────

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate($this->rules(), $this->messages());

        $staff = Staff::create($validated);

        if ($request->has('dependents')) {
            foreach ($request->dependents as $dep) {
                $staff->dependents()->create([
                    'name' => $dep['name'],
                    'relationship' => $dep['relationship'] ?? null,
                    'date_of_birth' => $dep['date_of_birth'] ?? null,
                ]);
            }
        }

        return response()->json([
            'success' => true,
            'message' => 'تمت إضافة الموظف بنجاح.',
            'data' => $staff->load(['dependents', 'distributions.basket']),
        ], 201);
    }

    // ─── Show ─────────────────────────────────────────────────────────────────

    public function show(string $id): JsonResponse
    {
        $staff = Staff::with(['dependents', 'distributions.basket'])->withCount('distributions')->findOrFail($id);

        return response()->json(['data' => $staff]);
    }

    // ─── Update ───────────────────────────────────────────────────────────────

    public function update(Request $request, string $id): JsonResponse
    {
        $staff = Staff::findOrFail($id);
        $rules = $this->rules($id);
        $validated = $request->validate($rules, $this->messages());

        $staff->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'تم تعديل بيانات الموظف بنجاح.',
            'data' => $staff->fresh()->load('dependents'),
        ]);
    }

    // ─── Destroy ──────────────────────────────────────────────────────────────

    public function destroy(string $id): JsonResponse
    {
        Staff::findOrFail($id)->delete();

        return response()->json(['success' => true, 'message' => 'تم حذف الموظف بنجاح.']);
    }

    // ─── Dependents ───────────────────────────────────────────────────────────

    public function storeDependent(Request $request, string $staffId): JsonResponse
    {
        $staff = Staff::findOrFail($staffId);
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'relationship' => 'nullable|string|max:100',
            'date_of_birth' => 'nullable|date',
        ]);
        $dep = $staff->dependents()->create($data);

        return response()->json(['success' => true, 'data' => $dep], 201);
    }

    public function destroyDependent(string $staffId, string $depId): JsonResponse
    {
        StaffDependent::where('staff_id', $staffId)->findOrFail($depId)->delete();

        return response()->json(['success' => true, 'message' => 'تم حذف المعال.']);
    }

    // ─── Excel Import ─────────────────────────────────────────────────────────

    // ─── Excel Import ─────────────────────────────────────────────────────────

    public function importExcel(Request $request): JsonResponse
    {
        try {
            $created = 0;
            $errors = [];
            $rows = [];

            if ($request->has('rows_json') && ! empty($request->input('rows_json'))) {
                $decoded = json_decode($request->input('rows_json'), true);
                if (is_array($decoded) && count($decoded) > 0) {
                    $rows = $decoded;
                }
            }

            if (empty($rows) && $request->has('rows') && is_array($request->input('rows')) && count($request->input('rows')) > 0) {
                $rows = $request->input('rows');
            }

            if (empty($rows) && $request->hasFile('file')) {
                $file = $request->file('file');
                $path = $file->getRealPath();
                $origName = $file->getClientOriginalName();
                $ext = strtolower(pathinfo($origName, PATHINFO_EXTENSION));

                if (in_array($ext, ['csv', 'txt'])) {
                    // CSV parsing
                    try {
                        $fileRows = array_map('str_getcsv', file($path));
                        if (count($fileRows) > 1) {
                            $header = array_map(function ($h) {
                                $str = trim((string) $h);

                                return mb_convert_encoding($str, 'UTF-8', 'UTF-8');
                            }, array_shift($fileRows));

                            foreach ($fileRows as $r) {
                                if (empty(array_filter($r))) {
                                    continue;
                                }
                                $r = array_map(function ($v) {
                                    $str = trim((string) $v);

                                    return mb_convert_encoding($str, 'UTF-8', 'UTF-8');
                                }, $r);

                                if (count($r) < count($header)) {
                                    $r = array_pad($r, count($header), '');
                                }
                                $rows[] = array_combine($header, array_slice($r, 0, count($header)));
                            }
                        }
                    } catch (\Throwable $e) {
                        \Log::error('CSV Read Error: '.$e->getMessage());
                    }
                } else {
                    // Excel (.xlsx, .xls) parsing using PhpSpreadsheet
                    try {
                        $reader = IOFactory::createReaderForFile($path);
                        $reader->setReadDataOnly(true);
                        $spreadsheet = $reader->load($path);
                        $worksheet = $spreadsheet->getActiveSheet();
                        $excelData = $worksheet->toArray('', true, true, true);

                        if (count($excelData) > 1) {
                            $headerKeys = array_shift($excelData);
                            $header = array_map(function ($h) {
                                $str = trim((string) $h);

                                return mb_convert_encoding($str, 'UTF-8', 'UTF-8');
                            }, array_values($headerKeys));

                            foreach ($excelData as $rowValues) {
                                $rowValues = array_map(function ($v) {
                                    $str = trim((string) $v);

                                    return mb_convert_encoding($str, 'UTF-8', 'UTF-8');
                                }, array_values($rowValues));

                                if (count($rowValues) < count($header)) {
                                    $rowValues = array_pad($rowValues, count($header), '');
                                }
                                $rows[] = array_combine($header, array_slice($rowValues, 0, count($header)));
                            }
                        }
                    } catch (\Throwable $e) {
                        \Log::error('Excel Read Error: '.$e->getMessage());
                    }
                }
            }

            foreach ($rows as $i => $row) {
                if (! is_array($row) || empty(array_filter($row))) {
                    continue;
                }

                $natId = $this->findValueInRow($row, ['national_id', 'nationalid', 'id', 'رقم الهوية', 'الهوية', 'رقم_الهوية', 'رقمالهوية', 'الرقم القومي', 'رقم الإقامة', 'الاقامة']);
                $name = $this->findValueInRow($row, ['name', 'full_name', 'fullname', 'الاسم', 'اسم الموظف', 'الاسم الكامل', 'اسم_الموظف', 'اسمالموظف', 'الموظف']);
                $phone = $this->findValueInRow($row, ['phone', 'mobile', 'phone_number', 'رقم الهاتف', 'الهاتف', 'رقم الجوال', 'الجوال', 'رقم_الهاتف', 'رقم_الجوال', 'هاتف']);
                $email = $this->findValueInRow($row, ['email', 'mail', 'البريد الإلكتروني', 'البريد', 'الإيميل', 'الايميل', 'البريد_الإلكتروني']);
                $job = $this->findValueInRow($row, ['job_title', 'jobtitle', 'job', 'position', 'المسمى الوظيفي', 'الوظيفة', 'المسمى_الوظيفي', 'وظيفة']);
                $dept = $this->findValueInRow($row, ['department', 'dept', 'القسم', 'الإدارة', 'قسم', 'الادارة']);
                $hireDate = $this->findValueInRow($row, ['hire_date', 'hiredate', 'تاريخ التعيين', 'تاريخ_التعيين', 'تاريخ التوظيف']);
                $salary = $this->findValueInRow($row, ['salary', 'الراتب', 'الراتب الشهري', 'الراتب الأساسي']);
                $status = $this->findValueInRow($row, ['status', 'الحالة', 'حالة الموظف']);
                $birthDate = $this->findValueInRow($row, ['birth_date', 'birthdate', 'تاريخ الميلاد', 'تاريخ_الميلاد']);
                $address = $this->findValueInRow($row, ['national_address', 'address', 'العنوان الوطني', 'العنوان', 'العنوان_الوطني']);
                $familyCount = $this->findValueInRow($row, ['family_members_count', 'family_count', 'عدد أفراد الأسرة', 'عدد افراد الاسرة', 'عدد الأسرة']);
                $wivesCount = $this->findValueInRow($row, ['wives_count', 'عدد الزوجات', 'الزوجات']);

                // Fallback positional indexing if key matching returned nothing
                if (empty($name) && empty($natId)) {
                    $vals = array_values($row);
                    if (isset($vals[0]) && trim((string) $vals[0]) !== '' && mb_strtolower(trim((string) $vals[0])) !== 'name' && trim((string) $vals[0]) !== 'الاسم') {
                        $name = mb_convert_encoding(trim((string) $vals[0]), 'UTF-8', 'UTF-8');
                        $natId = isset($vals[1]) ? mb_convert_encoding(trim((string) $vals[1]), 'UTF-8', 'UTF-8') : null;
                        $phone = isset($vals[2]) ? mb_convert_encoding(trim((string) $vals[2]), 'UTF-8', 'UTF-8') : null;
                        $job = isset($vals[3]) ? mb_convert_encoding(trim((string) $vals[3]), 'UTF-8', 'UTF-8') : null;
                        $dept = isset($vals[4]) ? mb_convert_encoding(trim((string) $vals[4]), 'UTF-8', 'UTF-8') : null;
                    }
                }

                if (empty($name) && empty($natId)) {
                    continue;
                }

                if (! empty($natId) && Staff::where('national_id', $natId)->exists()) {
                    $errors[] = 'الصف '.($i + 2).": رقم الهوية {$natId} مسجل مسبقاً";

                    continue;
                }

                // Parse status
                $parsedStatus = 'active';
                if ($status) {
                    $stClean = mb_strtolower(trim($status));
                    if (str_contains($stClean, 'إجازة') || str_contains($stClean, 'اجازة') || $stClean === 'on_leave') {
                        $parsedStatus = 'on_leave';
                    } elseif (str_contains($stClean, 'منتهي') || str_contains($stClean, 'موقوف') || $stClean === 'terminated') {
                        $parsedStatus = 'terminated';
                    }
                }

                try {
                    Staff::create([
                        'id' => (string) Str::uuid(),
                        'name' => $name ?? 'موظف جديد',
                        'national_id' => $natId,
                        'phone' => $phone,
                        'email' => $email,
                        'job_title' => $job ?? 'موظف',
                        'department' => $dept ?? 'عام',
                        'hire_date' => $hireDate ?? now()->toDateString(),
                        'salary' => is_numeric($salary) ? (float) $salary : 0,
                        'status' => $parsedStatus,
                        'birth_date' => $birthDate,
                        'national_address' => $address,
                        'family_members_count' => is_numeric($familyCount) ? (int) $familyCount : 1,
                        'wives_count' => is_numeric($wivesCount) ? (int) $wivesCount : 1,
                    ]);
                    $created++;
                } catch (\Exception $e) {
                    $errors[] = 'الصف '.($i + 2).': '.mb_convert_encoding($e->getMessage(), 'UTF-8', 'UTF-8');
                }
            }

            return response()->json([
                'success' => true,
                'created' => $created,
                'errors' => $errors,
                'message' => "تم استيراد {$created} موظف بنجاح.",
            ]);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => 'تعذر معالجة الملف: '.mb_convert_encoding($e->getMessage(), 'UTF-8', 'UTF-8')], 500);
        }
    }

    private function findValueInRow(array $row, array $possibleKeys): ?string
    {
        foreach ($row as $key => $val) {
            $cleanKey = mb_convert_encoding((string) $key, 'UTF-8', 'UTF-8');
            $normKey = $this->normalizeArabicKey($cleanKey);
            foreach ($possibleKeys as $pk) {
                if ($normKey === $this->normalizeArabicKey($pk)) {
                    $trimmed = trim((string) $val);
                    $cleanVal = mb_convert_encoding($trimmed, 'UTF-8', 'UTF-8');

                    return $cleanVal !== '' ? $cleanVal : null;
                }
            }
        }

        return null;
    }

    private function normalizeArabicKey(string $key): string
    {
        $key = mb_strtolower(trim($key));
        $key = str_replace(['أ', 'إ', 'آ'], 'ا', $key);
        $key = str_replace('ة', 'ه', $key);
        $key = str_replace('ى', 'ي', $key);
        $key = preg_replace('/[^\p{L}\p{N}]/u', '', $key);

        return $key;
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private function rules(?string $ignoreId = null): array
    {
        $uid = $ignoreId ? ",{$ignoreId}" : '';

        return [
            'name' => 'required|string|max:255',
            'national_id' => "required|string|max:10|unique:staff,national_id{$uid}",
            'phone' => 'required|string|max:20',
            'email' => "nullable|email|unique:staff,email{$uid}",
            'birth_date' => 'nullable|date',
            'national_address' => 'nullable|string|max:255',
            'job_title' => 'required|string|max:255',
            'department' => 'nullable|string|max:100',
            'hire_date' => 'required|date',
            'salary' => 'nullable|numeric|min:0',
            'status' => 'nullable|in:active,on_leave,terminated',
            'family_members_count' => 'nullable|integer|min:0',
            'wives_count' => 'nullable|integer|min:0|max:4',
            'father_status' => 'nullable|in:alive,deceased',
            'mother_status' => 'nullable|in:alive,deceased',
            'owns_house' => 'nullable|boolean',
            'dependents' => 'nullable|array',
            'dependents.*.name' => 'required|string|max:255',
            'dependents.*.relationship' => 'nullable|string|max:100',
            'dependents.*.date_of_birth' => 'nullable|date',
        ];
    }

    private function messages(): array
    {
        return [
            'name.required' => 'اسم الموظف مطلوب.',
            'national_id.required' => 'رقم الهوية مطلوب.',
            'national_id.unique' => 'رقم الهوية مسجل مسبقاً.',
            'phone.required' => 'رقم الهاتف مطلوب.',
            'job_title.required' => 'المسمى الوظيفي مطلوب.',
            'hire_date.required' => 'تاريخ التعيين مطلوب.',
        ];
    }
}
