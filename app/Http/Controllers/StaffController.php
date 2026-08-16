<?php

namespace App\Http\Controllers;

use App\Models\Staff;
use App\Models\StaffDependent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StaffController extends Controller
{
    // ─── Index ───────────────────────────────────────────────────────────────

    public function index(Request $request): JsonResponse
    {
        $query = Staff::with('dependents');

        if ($request->filled('status'))
            $query->where('status', $request->status);
        if ($request->filled('search')) {
            $s = $request->search;
            $query->where(fn($q) =>
                $q->where('name', 'like', "%{$s}%")
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
                    'name'          => $dep['name'],
                    'relationship'  => $dep['relationship'] ?? null,
                    'date_of_birth' => $dep['date_of_birth'] ?? null,
                ]);
            }
        }

        return response()->json([
            'success' => true,
            'message' => 'تمت إضافة الموظف بنجاح.',
            'data'    => $staff->load('dependents'),
        ], 201);
    }

    // ─── Show ─────────────────────────────────────────────────────────────────

    public function show(string $id): JsonResponse
    {
        $staff = Staff::with('dependents')->findOrFail($id);
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
            'data'    => $staff->fresh()->load('dependents'),
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
        $data  = $request->validate([
            'name'          => 'required|string|max:255',
            'relationship'  => 'nullable|string|max:100',
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

    public function importExcel(Request $request): JsonResponse
    {
        $request->validate(['file' => 'required|file|mimes:xlsx,xls,csv|max:10240']);

        $path = $request->file('file')->getRealPath();
        $rows = array_map('str_getcsv', file($path));
        $header = array_shift($rows);

        $created = 0;
        $errors  = [];

        foreach ($rows as $i => $row) {
            if (count($row) < count($header)) continue;
            $data = array_combine($header, $row);

            if (Staff::where('national_id', $data['national_id'] ?? '')->exists()) {
                $errors[] = "الصف " . ($i + 2) . ": رقم الهوية {$data['national_id']} مسجل مسبقاً";
                continue;
            }

            try {
                Staff::create([
                    'name'        => $data['name']       ?? null,
                    'national_id' => $data['national_id'] ?? null,
                    'phone'       => $data['phone']       ?? null,
                    'email'       => $data['email']       ?? null,
                    'job_title'   => $data['job_title']   ?? null,
                    'department'  => $data['department']  ?? null,
                    'hire_date'   => $data['hire_date']   ?? null,
                    'salary'      => $data['salary']      ?? 0,
                    'status'      => $data['status']      ?? 'active',
                ]);
                $created++;
            } catch (\Exception $e) {
                $errors[] = "الصف " . ($i + 2) . ": " . $e->getMessage();
            }
        }

        return response()->json([
            'success' => true,
            'created' => $created,
            'errors'  => $errors,
            'message' => "تم استيراد {$created} موظف بنجاح.",
        ]);
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private function rules(?string $ignoreId = null): array
    {
        $uid = $ignoreId ? ",{$ignoreId}" : '';
        return [
            'name'                 => 'required|string|max:255',
            'national_id'          => "required|string|max:10|unique:staff,national_id{$uid}",
            'phone'                => 'required|string|max:20',
            'email'                => "nullable|email|unique:staff,email{$uid}",
            'birth_date'           => 'nullable|date',
            'national_address'     => 'nullable|string|max:255',
            'job_title'            => 'required|string|max:255',
            'department'           => 'nullable|string|max:100',
            'hire_date'            => 'required|date',
            'salary'               => 'nullable|numeric|min:0',
            'status'               => 'nullable|in:active,on_leave,terminated',
            'family_members_count' => 'nullable|integer|min:0',
            'wives_count'          => 'nullable|integer|min:0|max:4',
            'father_status'        => 'nullable|in:alive,deceased',
            'mother_status'        => 'nullable|in:alive,deceased',
            'owns_house'           => 'nullable|boolean',
            'dependents'           => 'nullable|array',
            'dependents.*.name'    => 'required|string|max:255',
            'dependents.*.relationship' => 'nullable|string|max:100',
            'dependents.*.date_of_birth' => 'nullable|date',
        ];
    }

    private function messages(): array
    {
        return [
            'name.required'        => 'اسم الموظف مطلوب.',
            'national_id.required' => 'رقم الهوية مطلوب.',
            'national_id.unique'   => 'رقم الهوية مسجل مسبقاً.',
            'phone.required'       => 'رقم الهاتف مطلوب.',
            'job_title.required'   => 'المسمى الوظيفي مطلوب.',
            'hire_date.required'   => 'تاريخ التعيين مطلوب.',
        ];
    }
}
