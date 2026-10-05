<?php

namespace App\Services;

use App\Models\Beneficiary;
use App\Models\BeneficiaryPolicyVersion;
use App\Models\Category;
use App\Models\Setting;
use App\Services\BeneficiaryPolicy\PolicyConfigurationValidator;
use Illuminate\Validation\ValidationException;

class FinancialCalculationService
{
    /** Canonical policy income-source registry → storage field mapping (POLICY-B). */
    public const POLICY_INCOME_SOURCE_FIELDS = [
        'salary' => 'monthly_salary',
        'social_security' => 'social_security_amount',
        'citizen_account' => 'citizen_account_amount',
        'retirement' => 'retirement_pension',
        'family_support' => 'family_support',
        'social_insurance' => 'social_insurance_amount',
        'other' => 'other_income_amount',
    ];

    /** The citizen policy scope only — residents stay on the separate resident architecture. */
    public const POLICY_APPLICABLE_TYPES = ['citizen'];

    /** Sane monetary ceiling matching DECIMAL(14,2) storage capacity. */
    public const POLICY_MAX_AMOUNT = 999999999999.99;

    /** Deterministic money rounding (PHP_ROUND_HALF_UP on positive values). */
    public const POLICY_MONEY_DECIMALS = 2;

    private const POLICY_RENT_ANNUAL_DIVISOR = 12;

    /**
     * حساب البيانات المالية والتصنيف الاستحقاقي للمستفيد
     *
     * @param  array  $data  مصفوفة البيانات المالية والشخصية
     * @return array نتائج الاحتساب (إجمالي الدخل، الإيجار الشهري، صافي الدخل، التصنيف، الفئة)
     */
    public function calculate(array $data): array
    {
        $type = strtolower($data['beneficiary_type'] ?? 'citizen');
        $isCitizen = ($type === 'citizen');
        $allowedSources = $isCitizen
            ? ['salary', 'retirement', 'citizen_account', 'social_security', 'family_support']
            : ['salary', 'family_support'];
        $rawSources = $data['income_sources'] ?? [];
        if (is_string($rawSources)) {
            $decoded = json_decode($rawSources, true);
            $rawSources = is_array($decoded) ? $decoded : [];
        } elseif (! is_array($rawSources)) {
            $rawSources = [];
        }
        $selectedSources = array_values(array_intersect($allowedSources, $rawSources));

        // تنظيف وتحويل المدخلات المالية بأمان (منع القيم السالبة وتفادي null)
        $amount = static fn (string $source, string $field): float => in_array($source, $selectedSources, true)
            ? max(0, (float) ($data[$field] ?? 0)) : 0.0;
        $salary = $amount('salary', 'monthly_salary');
        $annualRent = max(0, (float) ($data['annual_rent_amount'] ?? 0));
        $monthlyRentDirect = max(0, (float) ($data['monthly_rent'] ?? ($data['monthly_rent_amount'] ?? 0)));
        $housingType = $data['housing_type'] ?? 'rent';

        // 1. حساب الإيجار الشهري
        $monthlyRent = 0.0;
        if ($housingType === 'rent') {
            if ($annualRent > 0) {
                $monthlyRent = round($annualRent / 12, 2);
            } elseif ($monthlyRentDirect > 0) {
                $monthlyRent = round($monthlyRentDirect, 2);
            }
        }

        // 2. حساب إجمالي الدخل بناءً على صفة المستفيد
        $totalIncome = 0.0;
        if ($isCitizen) {
            // المواطن: الراتب + التقاعد + حساب المواطن + الضمان الاجتماعي
            $pension = $amount('retirement', 'retirement_pension');
            $citizenAccount = $amount('citizen_account', 'citizen_account_amount');
            $socialSecurity = $amount('social_security', 'social_security_amount');
            $familySupport = $amount('family_support', 'family_support');

            $totalIncome = $salary + $pension + $citizenAccount + $socialSecurity + $familySupport;
        } else {
            // المقيم: الراتب + دعم الأسرة
            $familySupport = $amount('family_support', 'family_support');

            $totalIncome = $salary + $familySupport;
        }

        $totalIncome = round($totalIncome, 2);

        // 3. حساب صافي الدخل المتاح بعد خصم الإيجار
        $netIncome = max(0.0, round($totalIncome - $monthlyRent, 2));

        // 4. التصنيف التلقائي للأولوية والفئة ومستوى الاحتياج
        $priority = $this->determinePriority($data, $netIncome, $isCitizen);
        $categoryId = $this->getCategoryIdForPriority($priority);

        // 5. احتساب مستوى الاحتياج للمقيمين (منفصل عن درجة الاستحقاق)
        $needLevelData = $this->determineResidentNeedLevel($netIncome, $isCitizen);

        return [
            'total_income' => $totalIncome,
            'gross_income' => $totalIncome,
            'monthly_rent' => $monthlyRent,
            'net_income' => $netIncome,
            'priority' => $priority,
            'category_id' => $categoryId,
            'need_level' => $needLevelData['need_level'],
            'need_level_label' => $needLevelData['need_level_label'],
        ];
    }

    /**
     * POLICY-B — authoritative policy-aware financials.
     *
     * The ONE policy financial implementation (no competing calculator). Legacy
     * calculate() above is untouched; this contract consumes an explicit
     * PUBLISHED policy version and derives, from canonical stored inputs only:
     *
     * counted_gross_monthly_income = SUM(enabled counted sources, validated)
     * monthly_rent                 = explicit safe rent mode (annual/12 XOR direct)
     * family_size                  = head + active registered dependents (min 1)
     * family_member_deduction      = family_size × per_family_member_deduction
     * adjusted_net_household_income = MAX(0, counted − rent − deduction)
     * net_income_per_capita        = adjusted / MAX(1, family_size), 2 dp
     *
     * The result is a structured array suitable for snapshot persistence; it is
     * NOT mapped onto the legacy First/Second Degree or Need Level concepts.
     *
     * @throws ValidationException draft/non-citizen population / invalid amounts
     */
    public function calculatePolicyFinancials(Beneficiary $beneficiary, BeneficiaryPolicyVersion $version): array
    {
        if (! $version->isPublished()) {
            throw ValidationException::withMessages([
                'policy_version_id' => 'لا يمكن إجراء الاحتساب المالي إلا على نسخة سياسة منشورة.',
            ]);
        }
        if (! in_array($beneficiary->beneficiary_type, self::POLICY_APPLICABLE_TYPES, true)) {
            throw ValidationException::withMessages([
                'beneficiary_type' => 'سياسة المواطنين غير قابلة للتطبيق على المقيمين؛ المقيمون يُدارون عبر البنية المنفصلة.',
            ]);
        }

        $config = PolicyConfigurationValidator::withDefaults($version->configuration ?? []);
        $financial = $config['financial'];
        $countedSources = $financial['counted_income_sources'];
        $perMemberDeduction = (float) $financial['per_family_member_deduction'];
        $rentMode = in_array($financial['rent_mode'] ?? null, PolicyConfigurationValidator::RENT_MODES, true)
            ? $financial['rent_mode']
            : PolicyConfigurationValidator::DEFAULT_RENT_MODE;

        // 1. Counted gross income (strict source validation; missing optional source = 0).
        $sourceAmounts = $this->policySourceAmounts($beneficiary);
        $countedGross = 0.0;
        foreach ($countedSources as $source) {
            $countedGross += $sourceAmounts[$source] ?? 0.0;
        }
        $countedGross = round($countedGross, self::POLICY_MONEY_DECIMALS);

        // 2. Monthly rent — explicit safe mode, never annual + monthly together.
        $monthlyRent = $this->policyMonthlyRent($beneficiary, $rentMode);

        // 3. Authoritative family size — head + active registered dependents.
        $dependentsCount = $beneficiary->dependents()->where('is_active', true)->count();
        $familySize = max(1, 1 + $dependentsCount);

        // 4. Family deduction from the policy version value (never hardcoded in arithmetic).
        $familyMemberDeduction = round($familySize * $perMemberDeduction, self::POLICY_MONEY_DECIMALS);

        // 5. Adjusted net household income (never negative).
        $adjustedNet = round(max(0.0, $countedGross - $monthlyRent - $familyMemberDeduction), self::POLICY_MONEY_DECIMALS);

        // 6. Net income per capita — deterministic decimal rounding.
        $perCapita = round($adjustedNet / max(1, $familySize), self::POLICY_MONEY_DECIMALS);

        return [
            'policy_version_id' => $version->id,
            'policy_version' => $version->version,
            'calculated_at' => now()->toISOString(),
            'counted_gross_monthly_income' => $countedGross,
            'income_sources' => $this->policyIncomeBreakdown($sourceAmounts, $countedSources),
            'monthly_rent' => $monthlyRent,
            'rent_mode' => $rentMode,
            'family_size' => $familySize,
            'dependents_count' => $dependentsCount,
            'family_members_count_cached' => $beneficiary->family_members_count,
            'per_family_member_deduction' => $perMemberDeduction,
            'family_member_deduction' => $familyMemberDeduction,
            'adjusted_net_household_income' => $adjustedNet,
            'net_income_per_capita' => $perCapita,
            'precision' => [
                'rounding' => 'PHP_ROUND_HALF_UP',
                'decimal_places' => self::POLICY_MONEY_DECIMALS,
                'rent_annual_divisor' => self::POLICY_RENT_ANNUAL_DIVISOR,
            ],
        ];
    }

    /**
     * تحديد درجة أولوية المستفيد (Degree Classification)
     * - المواطن: درجة أولى أو ثانية بناءً على الحد المالي
     * - المقيم: درجة ثانية دائماً وبشكل قاطع (Approved Architecture Decision #8)
     */
    public function determinePriority(array $data, float $netIncome, bool $isCitizen): string
    {
        if (! $isCitizen) {
            // المقيم دائماً درجة ثانية؛ يُحظر أن يكون درجة أولى تحت أي ظرف
            return 'second_class';
        }

        $firstMax = (float) Setting::get('first_class_max_income', 3000);

        if ($netIncome <= $firstMax) {
            return 'first_class';
        }

        return 'second_class';
    }

    /**
     * احتساب مستوى الاحتياج للمقيم (Need Level)
     * منفصل تماماً عن درجة الاستحقاق، ويعتمد على الإعداد القابل للتخصيص من قبل المشرف العام
     */
    public function determineResidentNeedLevel(float $netIncome, bool $isCitizen): array
    {
        if ($isCitizen) {
            return [
                'need_level' => null,
                'need_level_label' => null,
            ];
        }

        // استرجاع حد الاحتياج من الإعدادات: المفتاح المعتمد resident_need_threshold أو المفتاح التاريخي resident_degree_threshold
        $threshold = (float) (Setting::get('resident_need_threshold')
            ?? Setting::get('resident_degree_threshold')
            ?? 3000);

        if ($netIncome <= $threshold) {
            return [
                'need_level' => 'severe_need',
                'need_level_label' => 'احتياج شديد',
            ];
        }

        return [
            'need_level' => 'normal_need',
            'need_level_label' => 'احتياج عادي',
        ];
    }

    /**
     * استرجاع معرف الفئة المرتبط بالأولوية
     */
    public function getCategoryIdForPriority(string $priority): ?string
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

    // ─── POLICY-B helpers (additive; legacy calculate() untouched) ────────────

    /**
     * Validate every registry source amount: numeric, non-negative, bounded,
     * deterministic 2-dp. Missing optional sources count as zero.
     *
     * Raw (uncast) values are validated so that junk can NEVER reach arithmetic
     * silently — the authoritative calculator is the final guardian even when a
     * decimal cast would otherwise throw mid-calculation.
     *
     * @return array<string, float> source => validated amount
     *
     * @throws ValidationException
     */
    private function policySourceAmounts(Beneficiary $beneficiary): array
    {
        $out = [];
        foreach (self::POLICY_INCOME_SOURCE_FIELDS as $source => $field) {
            $out[$source] = $this->validatedPolicyAmount($beneficiary->getRawOriginal($field), 'income_source.'.$source);
        }

        return $out;
    }

    private function validatedPolicyAmount(mixed $raw, string $label): float
    {
        if ($raw === null || $raw === '') {
            return 0.0;
        }
        if (! is_numeric($raw)) {
            throw ValidationException::withMessages([
                $label => 'قيمة غير رقمية لا يمكن تحويلها صامتاً إلى مبلغ.',
            ]);
        }
        $value = (float) $raw;
        if ($value < 0) {
            throw ValidationException::withMessages([
                $label => 'لا يمكن أن يكون المبلغ سالباً.',
            ]);
        }
        if ($value > self::POLICY_MAX_AMOUNT) {
            throw ValidationException::withMessages([
                $label => 'المبلغ يتجاوز الحد المسموح به في التخزين المالي.',
            ]);
        }

        return round($value, self::POLICY_MONEY_DECIMALS);
    }

    /**
     * Safe income breakdown (AVAILABLE / COUNTED / NOT COUNTED) for snapshots.
     * A registry source counts as AVAILABLE when it records a non-zero amount
     * (legacy NOT NULL columns default to 0, so 0 is the canonical "no income").
     */
    private function policyIncomeBreakdown(array $sourceAmounts, array $countedSources): array
    {
        $available = array_keys(array_filter($sourceAmounts, static fn (float $amount) => $amount > 0));
        $amounts = [];
        foreach ($available as $source) {
            $amounts[$source] = $sourceAmounts[$source];
        }

        return [
            'available' => $available,
            'counted' => array_values(array_unique($countedSources)),
            'not_counted' => array_values(array_diff($available, $countedSources)),
            'amounts' => $amounts,
        ];
    }

    /**
     * Explicit monthly-rent safe mode. Housings other than rent → 0.
     * Annual and monthly derived values are NEVER summed.
     */
    private function policyMonthlyRent(Beneficiary $beneficiary, string $mode): float
    {
        if ($beneficiary->housing_type !== 'rent') {
            return 0.0;
        }

        $annual = $this->validatedPolicyAmount($beneficiary->getRawOriginal('annual_rent_amount'), 'annual_rent_amount');
        // The stored monthly_rent column doubles as the legacy computed PREVIEW
        // (annual/12 XOR direct). POLICY-B direct mode therefore consumes the raw
        // input captured separately at the input boundary (monthly_rent_direct_input),
        // falling back to the stored preview only for pre-existing records.
        $rawDirect = $beneficiary->getRawOriginal('monthly_rent_direct_input');
        $direct = $rawDirect === null
            ? $this->validatedPolicyAmount($beneficiary->getRawOriginal('monthly_rent'), 'monthly_rent')
            : $this->validatedPolicyAmount($rawDirect, 'monthly_rent_direct_input');

        if ($mode === 'direct_monthly_preference') {
            if ($direct > 0) {
                return round($direct, self::POLICY_MONEY_DECIMALS);
            }
            if ($annual > 0) {
                return round($annual / self::POLICY_RENT_ANNUAL_DIVISOR, self::POLICY_MONEY_DECIMALS);
            }

            return 0.0;
        }

        // annual_preference — matches the legacy precedence exactly.
        if ($annual > 0) {
            return round($annual / self::POLICY_RENT_ANNUAL_DIVISOR, self::POLICY_MONEY_DECIMALS);
        }
        if ($direct > 0) {
            return round($direct, self::POLICY_MONEY_DECIMALS);
        }

        return 0.0;
    }
}
