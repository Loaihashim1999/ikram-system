<?php

namespace App\Http\Controllers\Beneficiaries;

use App\Http\Controllers\Controller;
use App\Models\Beneficiary;
use App\Models\Category;
use App\Models\Dependent;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use PhpOffice\PhpSpreadsheet\IOFactory;

class BeneficiaryController extends Controller
{
    // ─── Index ───────────────────────────────────────────────────────────────

    public function index(Request $request): JsonResponse
    {
        $query = Beneficiary::with(['dependents', 'distributions']);

        // Filter employees vs regular beneficiaries
        if ($request->input('type') === 'employee' || $request->input('priority') === 'employee') {
            $query->where(fn ($q) => $q->where('is_employee', true)->orWhere('priority', 'employee'));
        } else {
            $query->where('is_employee', false)->where('priority', '!=', 'employee');
        }

        if ($request->filled('type') && ! in_array($request->type, ['employee', 'all'])) {
            $query->where('beneficiary_type', $request->type);
        }
        if ($request->filled('beneficiary_type') && $request->beneficiary_type !== 'all') {
            $query->where('beneficiary_type', $request->beneficiary_type);
        }
        if ($request->filled('city') && $request->city !== 'all') {
            $query->where('city', 'like', "%{$request->city}%");
        }
        if ($request->filled('district') && $request->district !== 'all') {
            $query->where('district', 'like', "%{$request->district}%");
        }
        if ($request->filled('priority') && $request->priority !== 'all') {
            $query->where('priority', $request->priority);
        }
        if ($request->filled('status') && $request->status !== 'all') {
            $query->where('status', $request->status);
        }
        if ($request->filled('search')) {
            $s = $request->search;
            $query->where(fn ($q) => $q->where('full_name', 'like', "%{$s}%")
                ->orWhere('national_id', 'like', "%{$s}%")
                ->orWhere('phone', 'like', "%{$s}%")
            );
        }

        $perPage = intval($request->input('per_page', 500));
        if ($perPage <= 0 || $request->boolean('all')) {
            return response()->json(['data' => $query->latest()->get()]);
        }

        return response()->json(['data' => $query->latest()->paginate($perPage)]);
    }

    // ─── Store ───────────────────────────────────────────────────────────────

    public function store(Request $request): JsonResponse
    {
        try {
            $this->normalizeInputs($request);

            $validated = $request->validate($this->rules(), $this->messages());

            if (empty($validated['full_name']) && ! empty($request->input('name'))) {
                $validated['full_name'] = $request->input('name');
            }

            if (empty($validated['beneficiary_type']) && ! empty($request->input('type'))) {
                $validated['beneficiary_type'] = $request->input('type');
            }

            if (! empty($request->input('iban'))) {
                $validated['iban_encrypted'] = Crypt::encryptString($request->input('iban'));
            }

            if (empty($validated['created_by'])) {
                $validated['created_by'] = $request->user()?->id ?? User::first()?->id;
            }

            // احتساب البيانات المالية والتصنيف الاستحقاقي عبر FinancialCalculationService
            $calcService = app(\App\Services\FinancialCalculationService::class);
            $financials = $calcService->calculate($validated);

            $validated['total_income'] = $financials['total_income'];
            $validated['monthly_rent'] = $financials['monthly_rent'];
            $validated['net_income'] = $financials['net_income'];
            $validated['priority'] = $validated['priority'] ?? $financials['priority'];
            $validated['category_id'] = $validated['category_id'] ?? $financials['category_id'];

            $validated = array_merge($validated, $this->handleUploads($request));

            // حفظ المستفيد والتابعين داخل معاملة قاعدة بيانات متكاملة
            $beneficiary = DB::transaction(function () use ($validated, $request) {
                $b = Beneficiary::create($validated);
                $this->storeDependentsFromRequest($request, $b);
                return $b;
            });

            // تسجيل العملية في سجل التدقيق
            \Log::info("تم تسجيل مستفيد جديد بنجاح: {$beneficiary->full_name} ({$beneficiary->national_id})", [
                'beneficiary_id' => $beneficiary->id,
                'created_by' => $validated['created_by'],
                'priority' => $beneficiary->priority,
                'net_income' => $beneficiary->net_income,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'تمت إضافة وحفظ المستفيد والبيانات الأسرية بنجاح.',
                'data' => $beneficiary->load('dependents'),
            ], 201);
        } catch (ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'خطأ في التحقق من البيانات المطلوبة',
                'errors' => $e->errors(),
            ], 422);
        } catch (\Exception $e) {
            \Log::error('Beneficiary create failed: '.$e->getMessage(), [
                'trace' => $e->getTraceAsString(),
                'input' => $request->except(['iban', 'password']),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'حدث خطأ أثناء حفظ البيانات: '.$e->getMessage(),
                'error' => config('app.debug') ? $e->getMessage() : 'خطأ في الخادم',
            ], 500);
        }
    }

    private function storeDependentsFromRequest(Request $request, Beneficiary $beneficiary): void
    {
        $dependents = $request->input('dependents', []);

        if (empty($dependents) || ! is_array($dependents)) {
            return;
        }

        foreach ($dependents as $dep) {
            if (! empty($dep['name'])) {
                $beneficiary->dependents()->create([
                    'name' => $dep['name'],
                    'relationship' => $dep['relationship'] ?? null,
                    'date_of_birth' => $dep['date_of_birth'] ?? null,
                ]);
            }
        }
    }

    // ─── Auto-classify helper ─────────────────────────────────────────────────

    private function classifyPriority(array $data): string
    {
        if (! empty($data['is_employee'])) {
            return 'employee';
        }

        if (! empty($data['has_special_needs']) || ! empty($data['is_special_needs'])) {
            return 'special_needs';
        }

        if (! empty($data['date_of_birth'])) {
            try {
                $dob = Carbon::parse($data['date_of_birth']);
                $elderlyAge = (int) (DB::table('settings')->where('key', 'elderly_min_age')->value('value') ?? 60);
                if ($dob->age >= $elderlyAge) {
                    return 'elderly';
                }
            } catch (\Throwable) {
            }
        }

        $income =
            (float) ($data['monthly_salary'] ?? 0) +
            (float) ($data['citizen_account_amount'] ?? 0) +
            (float) ($data['social_security_amount'] ?? 0) +
            (float) ($data['retirement_pension'] ?? 0) +
            (float) ($data['family_support'] ?? 0);

        $firstMax = (float) (DB::table('settings')->where('key', 'first_class_max_income')->value('value') ?? 3000);
        $secondMax = (float) (DB::table('settings')->where('key', 'second_class_max_income')->value('value') ?? 6000);

        if ($income <= $firstMax) {
            return 'first_class';
        }
        if ($income <= $secondMax) {
            return 'second_class';
        }

        return 'second_class';
    }

    private function getCategoryIdForPriority(string $priority): ?string
    {
        $map = [
            'first_class' => 'درجة أولى',
            'second_class' => 'درجة ثانية',
            'special_needs' => 'ذوي الاحتياجات الخاصة',
            'elderly' => 'كبار السن',
            'employee' => 'عامل بالجمعية',
        ];

        $name = $map[$priority] ?? 'درجة أولى';
        $category = Category::where('name', 'like', "%{$name}%")->first();
        if (! $category) {
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
            'data' => $beneficiary->load(['dependents', 'distributions.basket']),
        ]);
    }

    // ─── Update ──────────────────────────────────────────────────────────────

    public function update(Request $request, Beneficiary $beneficiary): JsonResponse
    {
        try {
            $this->normalizeInputs($request);

            $rules = $this->rules($beneficiary->id);
            $validated = $request->validate($rules, $this->messages());

            if (! empty($request->input('iban'))) {
                $validated['iban_encrypted'] = Crypt::encryptString($request->input('iban'));
            }

            $validated = array_merge($validated, $this->handleUploads($request, $beneficiary));

            // احتساب البيانات المالية والتصنيف الاستحقاقي
            $mergedForCalc = array_merge($beneficiary->toArray(), $validated);
            $calcService = app(\App\Services\FinancialCalculationService::class);
            $financials = $calcService->calculate($mergedForCalc);

            $validated['total_income'] = $financials['total_income'];
            $validated['monthly_rent'] = $financials['monthly_rent'];
            $validated['net_income'] = $financials['net_income'];
            $validated['priority'] = $validated['priority'] ?? $financials['priority'];
            $validated['category_id'] = $validated['category_id'] ?? $financials['category_id'];

            DB::transaction(function () use ($beneficiary, $validated, $request) {
                $beneficiary->update($validated);

                if ($request->has('dependents') && is_array($request->input('dependents'))) {
                    $newDependents = array_filter($request->input('dependents'), fn ($d) => ! empty($d['name']));
                    // Only update/replace if valid dependents list is passed
                    $beneficiary->dependents()->delete();
                    foreach ($newDependents as $dep) {
                        $beneficiary->dependents()->create([
                            'name' => $dep['name'],
                            'relationship' => $dep['relationship'] ?? null,
                            'date_of_birth' => $dep['date_of_birth'] ?? null,
                        ]);
                    }
                }
            });

            \Log::info("تم تعديل بيانات المستفيد بنجاح: {$beneficiary->full_name} ({$beneficiary->national_id})", [
                'beneficiary_id' => $beneficiary->id,
                'priority' => $beneficiary->priority,
                'net_income' => $beneficiary->net_income,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'تم تعديل بيانات المستفيد بنجاح.',
                'data' => $beneficiary->fresh()->load('dependents'),
            ]);
        } catch (ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'خطأ في التحقق من البيانات أثناء التعديل',
                'errors' => $e->errors(),
            ], 422);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'تعذر تعديل المستفيد: '.$e->getMessage(),
            ], 500);
        }
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
            'name' => 'required|string|max:255',
            'relationship' => 'nullable|string|max:100',
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
            'success' => true,
            'exists' => $exists,
            'available' => ! $exists,
            'message' => $exists ? 'رقم الهوية مسجل مسبقاً' : 'رقم الهوية متاح',
        ]);
    }

    // ─── Extract OCR ─────────────────────────────────────────────────────────

    public function extractOcrData(Request $request): JsonResponse
    {
        $request->validate([
            'image' => 'required|file|image|max:10240',
            'type' => 'nullable|string',
        ]);

        return response()->json([
            'success' => true,
            'data' => [
                'full_name' => null,
                'national_id' => null,
                'date_of_birth' => null,
                'place_of_birth' => null,
                'nationality' => null,
            ],
        ]);
    }

    // ─── Excel Import ────────────────────────────────────────────────────────

    public function importExcel(Request $request): JsonResponse
    {
        try {
            $created = 0;
            $errors = [];
            $defaultUser = $request->user()?->id ?? User::first()?->id;

            $rows = [];

            // Read pre-parsed rows_json from FormData or array
            if ($request->has('rows_json') && ! empty($request->input('rows_json'))) {
                $decoded = json_decode($request->input('rows_json'), true);
                if (is_array($decoded)) {
                    $rows = $decoded;
                }
            } elseif ($request->has('rows') && is_array($request->input('rows'))) {
                $rows = $request->input('rows');
            } elseif ($request->hasFile('file')) {
                $file = $request->file('file');
                $path = $file->getRealPath();

                try {
                    $spreadsheet = IOFactory::load($path);
                    $worksheet = $spreadsheet->getActiveSheet();
                    $excelData = $worksheet->toArray(null, true, true, true);

                    if (count($excelData) > 1) {
                        $headerKeys = array_shift($excelData);
                        $header = array_map(function ($h) {
                            return trim((string) $h);
                        }, $headerKeys);

                        foreach ($excelData as $rowValues) {
                            $rowValues = array_values($rowValues);
                            if (count($rowValues) < count($header)) {
                                $rowValues = array_pad($rowValues, count($header), '');
                            }
                            $rows[] = array_combine($header, array_slice($rowValues, 0, count($header)));
                        }
                    }
                } catch (\Throwable $e) {
                    $content = file_get_contents($path);
                    $content = preg_replace('/^\xEF\xBB\xBF/', '', $content);
                    $lines = explode("\n", str_replace("\r", '', $content));
                    $lines = array_filter(array_map('trim', $lines));

                    if (! empty($lines)) {
                        $firstLine = array_shift($lines);
                        $delimiter = str_contains($firstLine, "\t") ? "\t" : (str_contains($firstLine, ';') ? ';' : ',');
                        $header = array_map(function ($h) {
                            return trim(str_replace(['"', "'"], '', $h));
                        }, explode($delimiter, $firstLine));

                        foreach ($lines as $line) {
                            if (empty($line)) {
                                continue;
                            }
                            $row = array_map(function ($val) {
                                return trim(str_replace(['"', "'"], '', $val));
                            }, explode($delimiter, $line));

                            if (count($row) < count($header)) {
                                $row = array_pad($row, count($header), '');
                            }
                            $rows[] = array_combine($header, array_slice($row, 0, count($header)));
                        }
                    }
                }
            }

            if (empty($rows)) {
                return response()->json(['success' => false, 'message' => 'الملف المرفوع فارغ أو لم يتم العثور على أسطر بيانات قابلة للقراءة.'], 400);
            }

            foreach ($rows as $i => $data) {
                if (! is_array($data)) {
                    continue;
                }

                // Extract fields using Arabic fuzzy matcher
                $natId = $this->findValueInRow($data, [
                    'national_id', 'national_id_number', 'id',
                    'رقم الهوية', 'رقم الهوية الوطنية', 'رقم الإقامة', 'رقم هوية', 'الهوية', 'الإقامة', 'السجل المدني',
                ]);

                if (! $natId) {
                    continue;
                }

                $natId = trim((string) $natId);

                if (Beneficiary::where('national_id', $natId)->exists()) {
                    $errors[] = 'الصف '.($i + 1).": رقم الهوية {$natId} مسجل مسبقاً بالنظام";

                    continue;
                }

                try {
                    $fullName = $this->findValueInRow($data, [
                        'full_name', 'name', 'اسم', 'الاسم', 'الاسم الكامل', 'اسم المستفيد', 'اسم المواطن', 'اسم المقيم',
                    ]);
                    if (! $fullName) {
                        $fullName = 'مستفيد جديد';
                    }

                    $phone = $this->findValueInRow($data, [
                        'phone', 'mobile', 'رقم الجوال', 'الجوال', 'الهاتف', 'رقم الهاتف',
                    ]);
                    if (! $phone) {
                        $phone = '0500000000';
                    }

                    $typeVal = $this->findValueInRow($data, [
                        'beneficiary_type', 'type', 'مواطن / مقيم', 'مواطن مقيم', 'النوع', 'نوع المستفيد',
                    ]);
                    $type = (in_array(mb_strtolower(trim((string) $typeVal)), ['resident', 'مقيم'])) ? 'resident' : 'citizen';

                    $city = $this->findValueInRow($data, ['city', 'المدينة', 'مكان السكن']) ?? '';
                    $district = $this->findValueInRow($data, ['district', 'الحي', 'اسم الحي', 'العنوان']) ?? '';
                    $street = $this->findValueInRow($data, ['street', 'الشارع']) ?? '';
                    $dob = $this->findValueInRow($data, ['date_of_birth', 'birth_date', 'تاريخ الميلاد']) ?? null;
                    $pob = $this->findValueInRow($data, ['place_of_birth', 'birth_place', 'مكان الميلاد']) ?? null;
                    $nationality = $this->findValueInRow($data, ['nationality', 'الجنسية']) ?? null;

                    $salary = (float) ($this->findValueInRow($data, ['monthly_salary', 'salary', 'راتب', 'الراتب', 'الراتب الشهري']) ?? 0);
                    $members = (int) ($this->findValueInRow($data, ['family_members_count', 'members', 'عدد الاسرة', 'عدد أفراد الأسرة', 'عدد الأفراد']) ?? 0);

                    $bData = [
                        'full_name' => trim((string) $fullName),
                        'national_id' => $natId,
                        'phone' => trim((string) $phone),
                        'beneficiary_type' => $type,
                        'city' => trim((string) $city),
                        'district' => trim((string) $district),
                        'street' => trim((string) $street),
                        'date_of_birth' => $dob ? trim((string) $dob) : null,
                        'place_of_birth' => $pob ? trim((string) $pob) : null,
                        'nationality' => $nationality ? trim((string) $nationality) : null,
                        'family_members_count' => $members,
                        'monthly_salary' => $salary,
                        'created_by' => $defaultUser,
                    ];

                    $priority = $this->classifyPriority($bData);
                    $bData['priority'] = $priority;
                    $bData['category_id'] = $this->getCategoryIdForPriority($priority);

                    Beneficiary::create($bData);
                    $created++;
                } catch (\Exception $e) {
                    $errors[] = 'الصف '.($i + 1).': '.$e->getMessage();
                }
            }

            return response()->json([
                'success' => true,
                'created' => $created,
                'errors' => $errors,
                'message' => $created > 0 ? "تم استيراد {$created} مستفيد بنجاح وتصنيفهم آلياً." : 'لم يتم استيراد أي مستفيد جديد (قد تكون الهوايا مسجلة مسبقاً أو غير مدخلة).',
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'حدث خطأ أثناء معالجة ملف الاستيراد: '.$e->getMessage(),
                'errors' => [$e->getMessage()],
            ], 400);
        }
    }

    private function normalizeArabicKey(string $key): string
    {
        $key = mb_strtolower(trim($key));
        $key = str_replace(['"', "'", '`', '_', '-', '/', '\\', '(', ')', '[', ']'], ' ', $key);
        $key = preg_replace('/[أإآ]/u', 'ا', $key);
        $key = preg_replace('/ة/u', 'ه', $key);
        $key = preg_replace('/\bال/u', '', $key);
        $key = preg_replace('/\s+/u', ' ', $key);

        return trim($key);
    }

    private function findValueInRow(array $row, array $targetPatterns): mixed
    {
        $normalizedRow = [];
        foreach ($row as $origKey => $val) {
            $normKey = $this->normalizeArabicKey((string) $origKey);
            $normalizedRow[$normKey] = $val;
        }

        // 1. Exact normalized key match (Highest Priority)
        foreach ($targetPatterns as $pattern) {
            $normPattern = $this->normalizeArabicKey($pattern);
            if (isset($normalizedRow[$normPattern]) && $normalizedRow[$normPattern] !== '' && $normalizedRow[$normPattern] !== null) {
                return $normalizedRow[$normPattern];
            }
        }

        // 2. Substring match fallback for longer patterns (len >= 3)
        foreach ($targetPatterns as $pattern) {
            $normPattern = $this->normalizeArabicKey($pattern);
            if (mb_strlen($normPattern) < 3) {
                continue;
            }

            foreach ($normalizedRow as $nk => $nv) {
                if ($nv !== '' && $nv !== null && mb_strlen($nk) >= 3) {
                    if ($nk === $normPattern || str_contains($nk, $normPattern)) {
                        return $nv;
                    }
                }
            }
        }

        return null;
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private function normalizeInputs(Request $request): void
    {
        $merge = [];
        if (empty($request->input('full_name')) && ! empty($request->input('name'))) {
            $merge['full_name'] = $request->input('name');
        }
        if (empty($request->input('beneficiary_type')) && ! empty($request->input('type'))) {
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

        $numericFields = [
            'family_members_count', 'wives_count', 'working_members_count',
            'non_working_children_count', 'annual_rent_amount', 'monthly_salary',
            'citizen_account_amount', 'social_security_amount', 'retirement_pension',
            'family_support',
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
        return [
            // ─── البيانات الأساسية الإلزامية (Basic Information) ───
            'full_name' => 'required|string|max:150',
            'national_id' => [
                'required',
                'string',
                'max:20',
                $ignoreId ? Rule::unique('beneficiaries', 'national_id')->ignore($ignoreId) : 'unique:beneficiaries,national_id',
            ],
            'phone' => 'required|string|max:20',
            'beneficiary_type' => 'required|in:citizen,resident',
            'city' => 'required|string|max:100',
            'district' => 'required|string|max:100',
            'street' => 'required|string|max:150',
            'nationality' => 'required_if:beneficiary_type,resident|nullable|string|max:100',
            'date_of_birth' => 'nullable|string',
            'place_of_birth' => 'nullable|string|max:100',
            'profession' => 'nullable|string|max:100',
            
            // ─── بيانات الأسرة والسكن الإلزامية (Family Information) ───
            'family_status' => 'required|string|max:50',
            'family_members_count' => 'required|integer|min:1',
            'housing_type' => 'required|in:rent,own,charitable_housing',
            'annual_rent_amount' => 'required_if:housing_type,rent|nullable|numeric|min:0',
            'monthly_rent' => 'nullable|numeric|min:0',
            'wives_count' => 'nullable|integer|min:0|max:4',
            'working_members_count' => 'nullable|integer|min:0',
            'non_working_children_count' => 'nullable|integer|min:0',
            'father_status' => 'nullable|string',
            'mother_status' => 'nullable|string',
            'owns_house' => 'nullable|boolean',

            // ─── الفئة والحالة ───
            'status' => 'nullable|in:active,suspended,under_review',
            'priority' => 'nullable|in:first_class,second_class,special_needs,elderly,employee',
            'category_id' => 'nullable|uuid',
            'has_special_needs' => 'nullable|boolean',
            'is_special_needs' => 'nullable|boolean',
            'is_elderly' => 'nullable|boolean',
            'is_employee' => 'nullable|boolean',

            // ─── البيانات المالية (Financial Information) ───
            'income_sources' => 'nullable|array',
            'monthly_salary' => 'nullable|numeric|min:0',
            'citizen_account_amount' => 'nullable|numeric|min:0',
            'social_security_amount' => 'nullable|numeric|min:0',
            'retirement_pension' => 'nullable|numeric|min:0',
            'family_support' => 'nullable|numeric|min:0',
            'bank_name' => 'nullable|string|max:100',
            'iban' => 'nullable|string|max:34',

            // ─── المعالون وأفراد الأسرة ───
            'dependents' => 'nullable|array',
            'dependents.*.name' => 'required|string|max:255',
            'dependents.*.relationship' => 'nullable|string|max:100',
            'dependents.*.date_of_birth' => 'nullable|date',

            // ─── الملفات المرفوعة ───
            'national_id_image' => 'nullable|file|image|max:5120',
            'residence_id_image' => 'nullable|file|image|max:5120',
            'citizen_account_image' => 'nullable|file|image|max:5120',
            'social_security_image' => 'nullable|file|image|max:5120',
            'pension_certificate_image' => 'nullable|file|mimes:pdf,jpg,jpeg,png|max:5120',
            'national_address_image' => 'nullable|file|image|max:5120',
            'rental_contract_image' => 'nullable|file|mimes:pdf,jpg,jpeg,png|max:5120',
            'electricity_bill_image' => 'nullable|file|image|max:5120',
            'salary_certificate' => 'nullable|file|mimes:pdf,jpg,jpeg,png|max:5120',
        ];
    }

    private function messages(): array
    {
        return [
            // البيانات الأساسية
            'full_name.required' => 'اسم المستفيد الكامل مطلوب.',
            'national_id.required' => 'رقم الهوية الوطنية أو الإقامة مطلوب.',
            'national_id.unique' => 'رقم الهوية/الإقامة مسجل مسبقاً في النظام.',
            'phone.required' => 'رقم الجوال مطلوب للتواصل.',
            'beneficiary_type.required' => 'يرجى تحديد صفة المستفيد (مواطن / مقيم).',
            'beneficiary_type.in' => 'صفة المستفيد يجب أن تكون مواطن أو مقيم.',
            'city.required' => 'المدينة مطلوبة.',
            'district.required' => 'الحي السكني مطلوب.',
            'street.required' => 'الشارع أو العنوان التفصيلي مطلوب.',
            'nationality.required_if' => 'الجنسية مطلوبة للمستفيد المقيم.',

            // بيانات الأسرة والسكن
            'family_status.required' => 'الحالة الأسرية مطلوبة.',
            'family_members_count.required' => 'عدد أفراد الأسرة مطلوب.',
            'family_members_count.min' => 'عدد أفراد الأسرة يجب أن يكون 1 على الأقل.',
            'housing_type.required' => 'يرجى تحديد نوع السكن.',
            'housing_type.in' => 'نوع السكن المحدد غير صالح.',
            'annual_rent_amount.required_if' => 'قيمة الإيجار السنوي مطلوبة عند اختيار نوع السكن إيجار.',
            'annual_rent_amount.min' => 'قيمة الإيجار لا يمكن أن تكون بالسالب.',
            'monthly_salary.min' => 'الراتب الشهري لا يمكن أن يكون قيمة سالبة.',
            'citizen_account_amount.min' => 'مبلغ حساب المواطن لا يمكن أن يكون سالباً.',
            'social_security_amount.min' => 'مبلغ الضمان الاجتماعي لا يمكن أن يكون سالباً.',
            'retirement_pension.min' => 'معاش التقاعد لا يمكن أن يكون سالباً.',
            'family_support.min' => 'دعم الأسرة لا يمكن أن يكون سالباً.',
        ];
    }

    private function handleUploads(Request $request, ?Beneficiary $existing = null): array
    {
        $fields = [
            'national_id_image' => 'national_id_image_url',
            'residence_id_image' => 'residence_id_image_url',
            'citizen_account_image' => 'citizen_account_image_url',
            'social_security_image' => 'social_security_image_url',
            'pension_certificate_image' => 'pension_certificate_image_url',
            'national_address_image' => 'national_address_image_url',
            'rental_contract_image' => 'rental_contract_image_url',
            'electricity_bill_image' => 'electricity_bill_image_url',
            'salary_certificate' => 'salary_certificate_url',
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
            'pension_certificate_image_url', 'national_address_image_url',
            'rental_contract_image_url', 'electricity_bill_image_url',
            'salary_certificate_url',
        ];
        foreach ($columns as $col) {
            if ($beneficiary->{$col}) {
                Storage::disk('public')->delete($beneficiary->{$col});
            }
        }
    }
}
