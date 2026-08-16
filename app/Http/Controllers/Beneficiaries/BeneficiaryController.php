<?php

namespace App\Http\Controllers\Beneficiaries;

use App\Http\Controllers\Controller;
use App\Models\Beneficiary;
use App\Models\Category;
use App\Models\Dependent;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class BeneficiaryController extends Controller
{
    // ─── Index ───────────────────────────────────────────────────────────────

    public function index(Request $request): JsonResponse
    {
        $query = Beneficiary::with(['dependents', 'distributions']);

        if ($request->filled('type')) {
            $query->where(fn($q) => $q->where('beneficiary_type', $request->type));
        }
        if ($request->filled('beneficiary_type')) {
            $query->where('beneficiary_type', $request->beneficiary_type);
        }
        if ($request->filled('priority')) {
            $query->where('priority', $request->priority);
        }
        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }
        if ($request->filled('search')) {
            $s = $request->search;
            $query->where(fn($q) =>
                $q->where('full_name', 'like', "%{$s}%")
                  ->orWhere('national_id', 'like', "%{$s}%")
                  ->orWhere('phone', 'like', "%{$s}%")
            );
        }

        $perPage = $request->input('per_page', 20);

        return response()->json(['data' => $query->latest()->paginate($perPage)]);
    }

    // ─── Store ───────────────────────────────────────────────────────────────

    public function store(Request $request): JsonResponse
    {
        try {
            $this->normalizeInputs($request);

            $validated = $request->validate($this->rules(), $this->messages());

            // Fill full_name if name was passed
            if (empty($validated['full_name']) && !empty($request->input('name'))) {
                $validated['full_name'] = $request->input('name');
            }

            // Fill beneficiary_type if type was passed
            if (empty($validated['beneficiary_type']) && !empty($request->input('type'))) {
                $validated['beneficiary_type'] = $request->input('type');
            }

            // Encrypt IBAN if provided
            if (!empty($request->input('iban'))) {
                $validated['iban_encrypted'] = Crypt::encryptString($request->input('iban'));
            }

            // Set created_by if missing
            if (empty($validated['created_by'])) {
                $validated['created_by'] = $request->user()?->id ?? User::first()?->id;
            }

            // Auto-classify priority
            $priority = $validated['priority'] ?? $this->classifyPriority($validated);
            $validated['priority'] = $priority;

            // Set category_id matching priority if missing
            if (empty($validated['category_id'])) {
                $validated['category_id'] = $this->getCategoryIdForPriority($priority);
            }

            // Handle file uploads
            $validated = array_merge($validated, $this->handleUploads($request));

            $beneficiary = Beneficiary::create($validated);

            // Store dependents from FormData
            $this->storeDependentsFromRequest($request, $beneficiary);

            return response()->json([
                'success' => true,
                'message' => 'تمت إضافة المستفيد بنجاح.',
                'data'    => $beneficiary->load('dependents'),
            ], 201);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'خطأ في التحقق من البيانات',
                'errors'  => $e->errors(),
            ], 422);
        } catch (\Exception $e) {
            \Log::error('Beneficiary create failed: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
                'input' => $request->except(['iban', 'password'])
            ]);
            return response()->json([
                'success' => false,
                'message' => 'حدث خطأ أثناء حفظ البيانات',
                'error'   => config('app.debug') ? $e->getMessage() : 'خطأ في الخادم',
            ], 500);
        }
    }

    /**
     * Store dependents from FormData request
     * Handles both JSON and FormData array formats
     */
    private function storeDependentsFromRequest(Request $request, Beneficiary $beneficiary): void
    {
        // Try to get dependents array
        $dependents = $request->input('dependents', []);
        
        if (empty($dependents) || !is_array($dependents)) {
            return;
        }

        foreach ($dependents as $dep) {
            if (!empty($dep['name'])) {
                $beneficiary->dependents()->create([
                    'name'          => $dep['name'],
                    'relationship'  => $dep['relationship'] ?? null,
                    'date_of_birth' => $dep['date_of_birth'] ?? null,
                ]);
            }
        }
    }

    // ─── Auto-classify helper ─────────────────────────────────────────────────

    private function classifyPriority(array $data): string
    {
        // Employee
        if (!empty($data['is_employee'])) {
            return 'employee';
        }

        // Special needs
        if (!empty($data['has_special_needs'])) {
            return 'special_needs';
        }

        // Elderly check (age ≥ 60)
        if (!empty($data['date_of_birth'])) {
            try {
                $dob = \Carbon\Carbon::parse($data['date_of_birth']);
                $elderlyAge = (int)(DB::table('settings')->where('key', 'elderly_min_age')->value('value') ?? 60);
                if ($dob->age >= $elderlyAge) return 'elderly';
            } catch (\Throwable) {}
        }

        // Income-based classification
        $income =
            (float)($data['monthly_salary'] ?? 0) +
            (float)($data['citizen_account_amount'] ?? 0) +
            (float)($data['social_security_amount'] ?? 0) +
            (float)($data['retirement_pension'] ?? 0) +
            (float)($data['family_support'] ?? 0);

        $firstMax  = (float)(DB::table('settings')->where('key', 'first_class_max_income')->value('value') ?? 3000);
        $secondMax = (float)(DB::table('settings')->where('key', 'second_class_max_income')->value('value') ?? 6000);

        if ($income <= $firstMax)  return 'first_class';
        if ($income <= $secondMax) return 'second_class';

        return 'second_class';
    }

    private function getCategoryIdForPriority(string $priority): ?string
    {
        $map = [
            'first_class'   => 'درجة أولى',
            'second_class'  => 'درجة ثانية',
            'special_needs' => 'ذوي الاحتياجات الخاصة',
            'elderly'       => 'كبار السن',
            'employee'      => 'عامل بالجمعية',
        ];

        $name = $map[$priority] ?? 'درجة أولى';
        $category = Category::where('name', 'like', "%{$name}%")->first();
        if (!$category) {
            $category = Category::firstOrCreate(
                ['name' => $name],
                ['description' => 'فئة تلقائية بالنظام', 'basket_entitlement_per_period' => 1]
            );
        }
        return $category?->id;
    }

    // ─── Show ─────────────────────────────────────────────────────────────────

    public function show(Beneficiary $beneficiary): JsonResponse
    {
        return response()->json([
            'data' => $beneficiary->load(['dependents', 'distributions'])
        ]);
    }

    // ─── Update ──────────────────────────────────────────────────────────────

    public function update(Request $request, Beneficiary $beneficiary): JsonResponse
    {
        $this->normalizeInputs($request);

        $rules = $this->rules($beneficiary->id);
        $validated = $request->validate($rules, $this->messages());

        if (!empty($request->input('iban'))) {
            $validated['iban_encrypted'] = Crypt::encryptString($request->input('iban'));
        }

        $validated = array_merge($validated, $this->handleUploads($request, $beneficiary));

        // Re-classify if priority not manually provided
        if (empty($validated['priority'])) {
            $merged = array_merge($beneficiary->toArray(), $validated);
            $validated['priority'] = $this->classifyPriority($merged);
        }

        if (empty($validated['category_id'])) {
            $validated['category_id'] = $this->getCategoryIdForPriority($validated['priority']);
        }

        $beneficiary->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'تم تعديل بيانات المستفيد بنجاح.',
            'data'    => $beneficiary->fresh()->load('dependents'),
        ]);
    }

    // ─── Destroy ─────────────────────────────────────────────────────────────

    public function destroy(Beneficiary $beneficiary): JsonResponse
    {
        $this->deleteUploads($beneficiary);
        $beneficiary->delete();

        return response()->json(['success' => true, 'message' => 'تم حذف المستفيد بنجاح.']);
    }

    // ─── Dependents ──────────────────────────────────────────────────────────

    public function storeDependent(Request $request, Beneficiary $beneficiary): JsonResponse
    {
        $data = $request->validate([
            'name'          => 'required|string|max:255',
            'relationship'  => 'nullable|string|max:100',
            'date_of_birth' => 'nullable|date',
        ]);

        $dep = $beneficiary->dependents()->create($data);

        return response()->json(['success' => true, 'data' => $dep], 201);
    }

    public function destroyDependent(Beneficiary $beneficiary, Dependent $dependent): JsonResponse
    {
        $dependent->delete();
        return response()->json(['success' => true, 'message' => 'تم حذف المعال.']);
    }

    // ─── Check National ID ───────────────────────────────────────────────────

    public function checkNationalId($nationalId): JsonResponse
    {
        $exists = Beneficiary::where('national_id', $nationalId)->exists();

        return response()->json([
            'success'   => true,
            'exists'    => $exists,
            'available' => !$exists,
            'message'   => $exists ? 'رقم الهوية مسجل مسبقاً' : 'رقم الهوية متاح',
        ]);
    }

    // ─── Extract OCR ─────────────────────────────────────────────────────────

    public function extractOcrData(Request $request): JsonResponse
    {
        $request->validate([
            'image' => 'required|file|image|max:10240',
            'type'  => 'nullable|string',
        ]);

        return response()->json([
            'success' => true,
            'data'    => [
                'full_name'     => null,
                'national_id'   => null,
                'date_of_birth' => null,
                'place_of_birth' => null,
                'nationality'   => null,
            ],
        ]);
    }

    // ─── Excel Import ────────────────────────────────────────────────────────

    public function importExcel(Request $request): JsonResponse
    {
        try {
            $request->validate(['file' => 'required|file|max:10240']);

            $file = $request->file('file');
            $path = $file->getRealPath();

            $created = 0;
            $errors  = [];

            $defaultUser = $request->user()?->id ?? User::first()?->id;

            $content = file_get_contents($path);
            $content = preg_replace('/^\xEF\xBB\xBF/', '', $content);
            $lines = explode("\n", str_replace("\r", "", $content));
            $lines = array_filter(array_map('trim', $lines));

            if (empty($lines)) {
                return response()->json(['success' => false, 'message' => 'الملف المرفوع فارغ.'], 400);
            }

            $firstLine = array_shift($lines);
            $delimiter = str_contains($firstLine, "\t") ? "\t" : (str_contains($firstLine, ";") ? ";" : ",");
            $header = array_map(function($h) {
                return strtolower(trim(str_replace(['"', "'"], '', $h)));
            }, explode($delimiter, $firstLine));

            foreach ($lines as $i => $line) {
                if (empty($line)) continue;
                $row = array_map(function($val) {
                    return trim(str_replace(['"', "'"], '', $val));
                }, explode($delimiter, $line));

                if (count($row) < count($header)) {
                    $row = array_pad($row, count($header), '');
                }

                $data = array_combine($header, array_slice($row, 0, count($header)));

                $natId = trim($data['national_id'] ?? $data['national_id_number'] ?? $data['رقم الهوية'] ?? $data['رقم الإقامة'] ?? '');
                if (!$natId) continue;

                if (Beneficiary::where('national_id', $natId)->exists()) {
                    $errors[] = "الصف " . ($i + 2) . ": رقم الهوية {$natId} مسجل مسبقاً";
                    continue;
                }

                try {
                    $fullName = trim($data['full_name'] ?? $data['name'] ?? $data['الاسم'] ?? $data['الاسم الكامل'] ?? 'مستفيد جديد');
                    $phone    = trim($data['phone'] ?? $data['mobile'] ?? $data['رقم الجوال'] ?? $data['الهاتف'] ?? '0500000000');
                    $type     = trim($data['beneficiary_type'] ?? $data['type'] ?? $data['نوع المستفيد'] ?? 'citizen');
                    $salary   = (float)($data['monthly_salary'] ?? $data['salary'] ?? $data['الراتب'] ?? 0);

                    $bData = [
                        'full_name'            => $fullName,
                        'national_id'          => $natId,
                        'phone'                => $phone,
                        'beneficiary_type'     => in_array($type, ['resident', 'مقيم']) ? 'resident' : 'citizen',
                        'city'                 => trim($data['city'] ?? $data['المدينة'] ?? ''),
                        'district'             => trim($data['district'] ?? $data['الحي'] ?? ''),
                        'family_members_count' => (int)($data['family_members_count'] ?? $data['عدد الأفراد'] ?? 0),
                        'monthly_salary'       => $salary,
                        'created_by'           => $defaultUser,
                    ];

                    $priority = $this->classifyPriority($bData);
                    $bData['priority'] = $priority;
                    $bData['category_id'] = $this->getCategoryIdForPriority($priority);

                    Beneficiary::create($bData);
                    $created++;
                } catch (\Exception $e) {
                    $errors[] = "الصف " . ($i + 2) . ": " . $e->getMessage();
                }
            }

            return response()->json([
                'success' => true,
                'created' => $created,
                'errors'  => $errors,
                'message' => "تم استيراد {$created} مستفيد بنجاح.",
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'حدث خطأ أثناء معالجة ملف الاستيراد: ' . $e->getMessage(),
                'errors'  => [$e->getMessage()],
            ], 400);
        }
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private function normalizeInputs(Request $request): void
    {
        $merge = [];
        if (empty($request->input('full_name')) && !empty($request->input('name'))) {
            $merge['full_name'] = $request->input('name');
        }
        if (empty($request->input('beneficiary_type')) && !empty($request->input('type'))) {
            $merge['beneficiary_type'] = $request->input('type');
        }
        if (empty($request->input('working_members_count')) && $request->has('working_count')) {
            $merge['working_members_count'] = $request->input('working_count');
        }
        if (empty($request->input('non_working_children_count')) && $request->has('non_working_children')) {
            $merge['non_working_children_count'] = $request->input('non_working_children');
        }
        if (empty($request->input('social_security_amount')) && $request->has('social_security')) {
            $merge['social_security_amount'] = $request->input('social_security');
        }
        if (empty($request->input('citizen_account_amount')) && $request->has('citizen_account')) {
            $merge['citizen_account_amount'] = $request->input('citizen_account');
        }

        // Clean empty string numeric inputs to null so numeric/integer rules don't fail
        $numericFields = [
            'family_members_count', 'wives_count', 'working_members_count',
            'non_working_children_count', 'annual_rent_amount', 'monthly_salary',
            'citizen_account_amount', 'social_security_amount', 'retirement_pension',
            'family_support'
        ];
        foreach ($numericFields as $f) {
            if ($request->has($f) && ($request->input($f) === '' || $request->input($f) === 'null')) {
                $merge[$f] = null;
            }
        }

        if (count($merge) > 0) {
            $request->merge($merge);
        }
    }

    private function rules(?string $ignoreId = null): array
    {
        $uniqueId = $ignoreId ? ",{$ignoreId}" : '';

        return [
            // أساسي
            'full_name'                  => 'required|string|max:150',
            'national_id'                => "required|string|max:20|unique:beneficiaries,national_id{$uniqueId}",
            'phone'                      => 'required|string|max:20',
            'beneficiary_type'           => 'nullable|in:citizen,resident',
            'status'                     => 'nullable|in:active,suspended,under_review',
            'priority'                   => 'nullable|in:first_class,second_class,special_needs,elderly',
            'category_id'                => 'nullable|uuid',
            'has_special_needs'          => 'nullable|boolean',
            'date_of_birth'              => 'nullable|date',
            'place_of_birth'             => 'nullable|string|max:100',
            'nationality'                => 'nullable|string|max:100',
            'profession'                 => 'nullable|string|max:100',
            // العنوان
            'city'                       => 'nullable|string|max:100',
            'district'                   => 'nullable|string|max:100',
            'street'                     => 'nullable|string|max:150',
            // بيانات الأسرة
            'family_status'              => 'nullable|string',
            'family_members_count'       => 'nullable|integer|min:0',
            'wives_count'                => 'nullable|integer|min:0|max:4',
            'working_members_count'      => 'nullable|integer|min:0',
            'non_working_children_count' => 'nullable|integer|min:0',
            'father_status'              => 'nullable|string',
            'mother_status'              => 'nullable|string',
            'owns_house'                 => 'nullable|boolean',
            // السكن
            'housing_type'               => 'nullable|string',
            'annual_rent_amount'         => 'nullable|numeric|min:0',
            // المالية
            'income_sources'             => 'nullable|array',
            'monthly_salary'             => 'nullable|numeric|min:0',
            'citizen_account_amount'     => 'nullable|numeric|min:0',
            'social_security_amount'     => 'nullable|numeric|min:0',
            'retirement_pension'         => 'nullable|numeric|min:0',
            'family_support'             => 'nullable|numeric|min:0',
            'bank_name'                  => 'nullable|string|max:100',
            'iban'                       => 'nullable|string|max:34',
            // المعالون
            'dependents'                 => 'nullable|array',
            'dependents.*.name'          => 'required|string|max:255',
            'dependents.*.relationship'  => 'nullable|string|max:100',
            'dependents.*.date_of_birth' => 'nullable|date',
            // الملفات
            'national_id_image'          => 'nullable|file|image|max:5120',
            'residence_id_image'         => 'nullable|file|image|max:5120',
            'citizen_account_image'      => 'nullable|file|image|max:5120',
            'social_security_image'      => 'nullable|file|image|max:5120',
            'national_address_image'     => 'nullable|file|image|max:5120',
            'rental_contract_image'      => 'nullable|file|mimes:pdf,jpg,jpeg,png|max:5120',
            'electricity_bill_image'     => 'nullable|file|image|max:5120',
            'salary_certificate'         => 'nullable|file|mimes:pdf,jpg,jpeg,png|max:5120',
        ];
    }

    private function messages(): array
    {
        return [
            'full_name.required'   => 'اسم المستفيد مطلوب.',
            'national_id.required' => 'رقم الهوية مطلوب.',
            'national_id.unique'   => 'رقم الهوية مسجل مسبقاً في النظام.',
            'phone.required'       => 'رقم الهاتف مطلوب.',
        ];
    }

    private function handleUploads(Request $request, ?Beneficiary $existing = null): array
    {
        $fields = [
            'national_id_image'      => 'national_id_image_url',
            'residence_id_image'     => 'residence_id_image_url',
            'citizen_account_image'  => 'citizen_account_image_url',
            'social_security_image'  => 'social_security_image_url',
            'national_address_image' => 'national_address_image_url',
            'rental_contract_image'  => 'rental_contract_image_url',
            'electricity_bill_image' => 'electricity_bill_image_url',
            'salary_certificate'     => 'salary_certificate_url',
        ];

        $result = [];
        foreach ($fields as $input => $column) {
            if ($request->hasFile($input)) {
                if ($existing && $existing->{$column}) {
                    Storage::disk('public')->delete($existing->{$column});
                }
                $result[$column] = $request->file($input)->store('beneficiaries', 'public');
            }
        }
        return $result;
    }

    private function deleteUploads(Beneficiary $beneficiary): void
    {
        $columns = [
            'national_id_image_url', 'residence_id_image_url',
            'citizen_account_image_url', 'social_security_image_url',
            'national_address_image_url', 'rental_contract_image_url',
            'electricity_bill_image_url', 'salary_certificate_url',
        ];
        foreach ($columns as $col) {
            if ($beneficiary->{$col}) {
                Storage::disk('public')->delete($beneficiary->{$col});
            }
        }
    }
}