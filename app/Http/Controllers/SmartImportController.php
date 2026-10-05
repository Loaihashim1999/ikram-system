<?php

namespace App\Http\Controllers;

use App\Models\Beneficiary;
use App\Models\Category;
use App\Models\NeighborhoodRep;
use App\Models\Staff;
use App\Models\User;
use App\Services\SmartExcelImportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class SmartImportController extends Controller
{
    public function preview(Request $request, string $entity, SmartExcelImportService $service): JsonResponse
    {
        $fields = $this->fields($entity);
        $request->validate(['file' => 'required|file|max:10240|mimes:xlsx,xls,csv']);
        $sheets = $service->read($request->file('file'));
        foreach ($sheets as &$sheet) {
            $sheet['suggested_mapping'] = $service->suggest($sheet['headers'], $fields);
            $sheet['preview_rows'] = array_slice($sheet['rows'], 0, 10);
            $sheet['row_count'] = count($sheet['rows']);
            unset($sheet['rows']);
        }

        return response()->json(['success' => true, 'fields' => $fields, 'sheets' => $sheets]);
    }

    public function store(Request $request, string $entity, SmartExcelImportService $service): JsonResponse
    {
        $fields = $this->fields($entity);
        $request->validate([
            'file' => 'required|file|max:10240|mimes:xlsx,xls,csv',
            'sheet' => 'nullable|string|max:100',
            'mapping' => 'required',
        ]);
        $mapping = is_string($request->mapping) ? json_decode($request->mapping, true) : $request->mapping;
        if (! is_array($mapping) || count(array_filter($mapping)) === 0) {
            return response()->json(['success' => false, 'message' => 'يجب مطابقة عمود واحد على الأقل.'], 422);
        }
        foreach (array_filter($mapping) as $target) {
            if (! array_key_exists($target, $fields)) {
                return response()->json(['success' => false, 'message' => 'تحتوي المطابقة على حقل غير صالح.'], 422);
            }
        }

        $sheets = $service->read($request->file('file'));
        $sheet = collect($sheets)->firstWhere('name', $request->sheet) ?? $sheets[0];
        $rows = $service->mapRows($sheet['rows'], $mapping);
        $created = 0;
        $skipped = 0;
        $errors = [];

        DB::transaction(function () use ($rows, $entity, $request, &$created, &$skipped, &$errors) {
            foreach ($rows as $index => $row) {
                $rowNumber = $index + 2;
                $result = $this->importRow($entity, $row, $request->user()?->id, $rowNumber);
                if ($result['status'] === 'created') {
                    $created++;
                } elseif ($result['status'] === 'skipped') {
                    $skipped++;
                } else {
                    $errors[] = $result['message'];
                }
            }
        });

        return response()->json([
            'success' => true,
            'created' => $created,
            'skipped' => $skipped,
            'failed' => count($errors),
            'total' => count($rows),
            'errors' => array_slice($errors, 0, 100),
            'message' => "تم استيراد {$created} من أصل ".count($rows).' سجل.',
        ]);
    }

    private function importRow(string $entity, array $row, ?string $userId, int $rowNumber): array
    {
        $row = array_map(fn ($v) => is_string($v) ? trim($v) : $v, $row);
        if ($entity === 'beneficiaries') {
            $row['beneficiary_type'] = $this->enum($row['beneficiary_type'] ?? null, ['مقيم' => 'resident', 'resident' => 'resident'], 'citizen');
            $row['status'] = $this->enum($row['status'] ?? null, ['موقوف' => 'suspended', 'مراجعه' => 'under_review', 'underreview' => 'under_review'], 'active');
            $row['created_by'] = $userId ?? User::query()->value('id');
            $validator = Validator::make($row, ['full_name' => 'required|string|max:150', 'national_id' => 'required|string|max:20', 'phone' => 'required|string|max:20', 'date_of_birth' => 'nullable|date', 'monthly_salary' => 'nullable|numeric|min:0', 'family_members_count' => 'nullable|integer|min:0']);
            if ($validator->fails()) {
                return $this->failed($rowNumber, $validator->errors()->first());
            }
            if (Beneficiary::where('national_id', $row['national_id'])->exists()) {
                return ['status' => 'skipped'];
            }
            $row['category_id'] = Category::query()->value('id') ?? Category::create(['name' => 'غير مصنف', 'description' => 'أنشئت للاستيراد المرن', 'basket_entitlement_per_period' => 1])->id;
            Beneficiary::create(array_intersect_key($row, array_flip((new Beneficiary)->getFillable())));
        } elseif ($entity === 'staff') {
            $row['status'] = $this->enum($row['status'] ?? null, ['اجازه' => 'on_leave', 'onleave' => 'on_leave', 'منتهي' => 'terminated', 'موقوف' => 'terminated'], 'active');
            $validator = Validator::make($row, ['name' => 'required|string|max:255', 'national_id' => 'required|string|max:10', 'phone' => 'required|string|max:20', 'email' => 'nullable|email', 'job_title' => 'required|string|max:255', 'hire_date' => 'required|date', 'salary' => 'nullable|numeric|min:0']);
            if ($validator->fails()) {
                return $this->failed($rowNumber, $validator->errors()->first());
            }
            if (Staff::where('national_id', $row['national_id'])->exists()) {
                return ['status' => 'skipped'];
            }
            Staff::create(array_intersect_key($row, array_flip((new Staff)->getFillable())));
        } else {
            $row['status'] = $this->enum($row['status'] ?? null, ['موقوف' => 'suspended', 'غيرنشط' => 'suspended'], 'active');
            $row['organization_name'] = $row['organization_name'] ?? ($row['full_name'] ?? null);
            $row['national_id'] = $row['national_id'] ?? ($row['license_number'] ?? null);
            $validator = Validator::make($row, ['full_name' => 'required|string|max:150', 'phone' => 'required|string|max:20', 'district_name' => 'required|string|max:100', 'license_number' => 'nullable|string|max:50', 'email' => 'nullable|email|max:150']);
            if ($validator->fails()) {
                return $this->failed($rowNumber, $validator->errors()->first());
            }
            $duplicate = NeighborhoodRep::where(function ($q) use ($row) {
                $q->where('phone', $row['phone']);
                if (! empty($row['license_number'])) {
                    $q->orWhere('license_number', $row['license_number']);
                }
            })->exists();
            if ($duplicate) {
                return ['status' => 'skipped'];
            }
            NeighborhoodRep::create(array_intersect_key($row, array_flip((new NeighborhoodRep)->getFillable())));
        }

        return ['status' => 'created'];
    }

    private function failed(int $row, string $message): array
    {
        return ['status' => 'failed', 'message' => "الصف {$row}: {$message}"];
    }

    private function enum(?string $value, array $map, string $default): string
    {
        $key = preg_replace('/[^\p{L}\p{N}]/u', '', mb_strtolower((string) $value));

        return $map[$key] ?? $default;
    }

    private function fields(string $entity): array
    {
        $sets = [
            'beneficiaries' => [
                'full_name' => ['label' => 'الاسم الكامل', 'required' => true, 'aliases' => ['الاسم', 'اسم المستفيد', 'name']], 'national_id' => ['label' => 'رقم الهوية أو الإقامة', 'required' => true, 'aliases' => ['الهوية', 'السجل المدني', 'رقم الاقامة']], 'phone' => ['label' => 'رقم الجوال', 'required' => true, 'aliases' => ['الهاتف', 'الجوال', 'mobile']], 'beneficiary_type' => ['label' => 'نوع المستفيد', 'aliases' => ['النوع', 'مواطن أو مقيم']], 'date_of_birth' => ['label' => 'تاريخ الميلاد', 'aliases' => ['ميلاد', 'birth date']], 'city' => ['label' => 'المدينة', 'aliases' => []], 'district' => ['label' => 'الحي', 'aliases' => ['اسم الحي']], 'street' => ['label' => 'الشارع', 'aliases' => ['العنوان']], 'nationality' => ['label' => 'الجنسية', 'aliases' => []], 'monthly_salary' => ['label' => 'الراتب الشهري', 'aliases' => ['الدخل', 'الراتب']], 'family_members_count' => ['label' => 'عدد أفراد الأسرة', 'aliases' => ['عدد الافراد']], 'status' => ['label' => 'الحالة', 'aliases' => []],
            ],
            'staff' => [
                'name' => ['label' => 'اسم الموظف', 'required' => true, 'aliases' => ['الاسم', 'full name']], 'national_id' => ['label' => 'رقم الهوية', 'required' => true, 'aliases' => ['الهوية', 'السجل المدني']], 'phone' => ['label' => 'رقم الجوال', 'required' => true, 'aliases' => ['الهاتف', 'mobile']], 'email' => ['label' => 'البريد الإلكتروني', 'aliases' => ['الايميل', 'email']], 'job_title' => ['label' => 'المسمى الوظيفي', 'required' => true, 'aliases' => ['الوظيفة']], 'department' => ['label' => 'القسم', 'aliases' => ['الادارة']], 'hire_date' => ['label' => 'تاريخ التعيين', 'required' => true, 'aliases' => ['تاريخ التوظيف']], 'salary' => ['label' => 'الراتب', 'aliases' => ['الراتب الشهري']], 'birth_date' => ['label' => 'تاريخ الميلاد', 'aliases' => []], 'national_address' => ['label' => 'العنوان الوطني', 'aliases' => ['العنوان']], 'family_members_count' => ['label' => 'عدد أفراد الأسرة', 'aliases' => []], 'status' => ['label' => 'الحالة', 'aliases' => []],
            ],
            'organizations' => [
                'full_name' => ['label' => 'اسم الجهة', 'required' => true, 'aliases' => ['اسم المنظمة', 'الجهة', 'organization name']], 'organization_type' => ['label' => 'نوع الجهة', 'aliases' => ['نوع المنظمة']], 'license_number' => ['label' => 'رقم الترخيص', 'aliases' => ['الترخيص', 'رقم السجل']], 'contact_person' => ['label' => 'اسم المسؤول', 'aliases' => ['المفوض', 'مسؤول التواصل']], 'email' => ['label' => 'البريد الإلكتروني', 'aliases' => ['البريد', 'الايميل']], 'phone' => ['label' => 'رقم التواصل', 'required' => true, 'aliases' => ['الجوال', 'الهاتف']], 'district_name' => ['label' => 'الحي', 'required' => true, 'aliases' => ['اسم الحي']], 'city' => ['label' => 'المدينة', 'aliases' => []], 'national_address' => ['label' => 'العنوان الوطني', 'aliases' => ['العنوان']], 'beneficiaries_count' => ['label' => 'عدد المستفيدين', 'aliases' => ['عدد الاسر']], 'status' => ['label' => 'الحالة', 'aliases' => []],
            ],
        ];
        abort_unless(isset($sets[$entity]), 404);

        return $sets[$entity];
    }
}
