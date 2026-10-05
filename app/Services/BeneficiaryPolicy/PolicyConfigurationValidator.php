<?php

namespace App\Services\BeneficiaryPolicy;

use Illuminate\Validation\ValidationException;

/**
 * PolicyConfigurationValidator — strict, versioned structured configuration (POLICY-A).
 *
 * Rules:
 * - Only the approved section allowlist may appear at the top level.
 * - Each section must be an object (structured, never raw JSON text).
 * - Known anchors are type/value checked; every key must be an identifier-safe
 *   name and nesting is bounded so future phases extend via the same validator.
 * - Unknown keys/sections are rejected — no silent drift inside published config.
 *
 * POLICY-C adds strict validation for income_categories, scoring,
 * score_categories and exceptions (boundaries, overlap, gaps, duplicates,
 * maximum score, known dimensions, allowlisted exception codes). Deterministic
 * monetary/percent boundary comparisons use integer cents (never float drift).
 */
final class PolicyConfigurationValidator
{
    /** Safe policy configuration sections. */
    public const SECTIONS = [
        'financial',
        'eligibility',
        'income_categories',
        'scoring',
        'score_categories',
        'documents',
        'exceptions',
        'application_scope',
    ];

    /** Income-source registry keys (all remain available; only counted keys are summed once enabled). */
    public const INCOME_SOURCE_KEYS = [
        'salary',
        'social_security',
        'citizen_account',
        'retirement',
        'family_support',
        'social_insurance',
        'other',
    ];

    /** Approved DEFAULT counted income sources for the citizen policy. */
    public const DEFAULT_COUNTED_INCOME_SOURCES = ['salary', 'social_security', 'citizen_account'];

    /** Approved default per-family-member deduction (SAR). */
    public const DEFAULT_FAMILY_MEMBER_DEDUCTION = 100;

    /** Explicit monthly-rent safe modes (POLICY-B). Annual preference matches the legacy behaviour. */
    public const RENT_MODES = ['annual_preference', 'direct_monthly_preference'];

    public const DEFAULT_RENT_MODE = 'annual_preference';

    /** Structured basic eligibility review gates (POLICY-B) — allowlisted booleans. */
    public const ELIGIBILITY_REVIEW_KEYS = [
        'documents' => true,
        'service_area' => true,
        'landlord_relation' => true,
        'family_status' => true,
        'male_under_40' => true,
    ];

    /** Approved application scopes — modelled only; executed in POLICY-E. */
    public const APPLICATION_SCOPES = ['new_only', 'all_existing_and_new', 'selected_existing_and_new', 'effective_from_date'];

    public const DEFAULT_APPLIES_TO = 'all_existing_and_new';

    // ── POLICY-C: income categories ─────────────────────────────────────────

    /** Income-category stable keys (A–D). The exclusion marker is NOT a band key. */
    public const INCOME_CATEGORY_KEYS = ['a', 'b', 'c', 'd'];

    /** Default income exclusion threshold (SAR per capita) — Version 4. */
    public const DEFAULT_INCOME_EXCLUSION_THRESHOLD = 1000.0;

    /** Deterministic band step for money/percent boundaries (cents). */
    public const BAND_STEP = 0.01;

    // ── POLICY-C: scoring ───────────────────────────────────────────────────

    /** Known scoring dimensions (allowlist) — one component per canonical input. */
    public const SCORING_DIMENSIONS = ['income', 'housing_condition', 'housing_tenure', 'head_health', 'children_health', 'age'];

    /** Documented maximum score — Version 4. */
    public const DEFAULT_MAX_SCORE = 75;

    // ── POLICY-C: score categories ──────────────────────────────────────────

    /** Score-category stable keys (A–D). */
    public const SCORE_CATEGORY_KEYS = ['a', 'b', 'c', 'd'];

    // ── POLICY-C: exceptions ────────────────────────────────────────────────

    /** Allowed exception codes (allowlist — never free-form). */
    public const EXCEPTION_CODES = ['orphan_mother'];

    /** Orphan-mother exception ceiling (SAR per capita) — Version 4. */
    public const DEFAULT_EXCEPTION_CEILING = 1200.0;

    /** Structured fields an exception condition may read. */
    public const EXCEPTION_CONDITION_FIELDS = ['family_status'];

    public const EXCEPTION_CONDITION_OPERATORS = ['in'];

    /** Canonical family status enum values (beneficiaries.family_status). */
    public const FAMILY_STATUS_VALUES = [
        'poor', 'widow', 'widow_with_orphans',
        'divorced', 'divorced_with_children', 'abandoned',
    ];

    private const KEY_PATTERN = '/^[a-z][a-z0-9_]*$/';

    private const MAX_DEPTH = 5;

    /**
     * Validate and normalize a configuration payload.
     *
     * @param  array  $configuration  decoded JSON object (array)
     * @return array validated, normalized configuration (defaults merged)
     *
     * @throws ValidationException
     */
    public static function validate(array $configuration): array
    {
        $unknown = array_values(array_diff(array_keys($configuration), self::SECTIONS));
        if ($unknown !== []) {
            throw ValidationException::withMessages([
                'configuration' => 'أقسام غير معروفة في الإعدادات: '.implode('، ', $unknown),
            ]);
        }

        foreach ($configuration as $section => $value) {
            if (! is_array($value)) {
                throw ValidationException::withMessages([
                    "configuration.{$section}" => 'يجب أن يكون القسم كائناً صالحاً (وليس نصاً خام).',
                ]);
            }
            self::assertShape($value, "configuration.{$section}", 1);
        }

        // Merge approved defaults FIRST so every section is complete & strict-checked.
        $merged = self::withDefaults($configuration);

        self::validateFinancial($merged);
        self::validateEligibility($merged);
        self::validateIncomeCategories($merged);
        self::validateScoring($merged);
        self::validateScoreCategories($merged);
        self::validateExceptions($merged);
        self::validateDocuments($merged);
        self::validateApplicationScope($merged);

        return $merged;
    }

    /**
     * Merge approved defaults so every published configuration is complete and deterministic.
     */
    public static function withDefaults(array $configuration): array
    {
        $financial = $configuration['financial'] ?? [];
        $financial['per_family_member_deduction'] ??= self::DEFAULT_FAMILY_MEMBER_DEDUCTION;
        $financial['counted_income_sources'] ??= self::DEFAULT_COUNTED_INCOME_SOURCES;
        $financial['rent_mode'] ??= self::DEFAULT_RENT_MODE;

        $eligibility = $configuration['eligibility'] ?? [];
        $eligibility['review'] = array_merge(self::ELIGIBILITY_REVIEW_KEYS, $eligibility['review'] ?? []);

        $scope = $configuration['application_scope'] ?? [];
        $scope['applies_to'] ??= self::DEFAULT_APPLIES_TO;

        $configuration['financial'] = $financial;
        $configuration['eligibility'] = $eligibility;
        $configuration['application_scope'] = $scope;

        $configuration['income_categories'] = self::defaultIncomeCategories($configuration['income_categories'] ?? []);
        $configuration['scoring'] = self::defaultScoring($configuration['scoring'] ?? [], $configuration['income_categories']);
        $configuration['score_categories'] = self::defaultScoreCategories($configuration['score_categories'] ?? [], $configuration['scoring']);
        $configuration['exceptions'] = self::defaultExceptions($configuration['exceptions'] ?? [], $configuration['income_categories']);
        $configuration['documents'] = self::defaultDocuments($configuration['documents'] ?? []);

        // Keep section order stable for readable diffs.
        $ordered = array_fill_keys(self::SECTIONS, []);
        foreach ($configuration as $section => $value) {
            $ordered[$section] = $value;
        }

        return array_filter($ordered, static fn ($value) => $value !== []);
    }

    // ── Defaults ────────────────────────────────────────────────────────────

    public static function defaultIncomeCategories(array $section = []): array
    {
        $threshold = $section['exclusion_threshold'] ?? self::DEFAULT_INCOME_EXCLUSION_THRESHOLD;

        return [
            'exclusion_threshold' => $threshold,
            'bands' => self::normalizeNumbers([
                ['key' => 'a', 'label' => 'فئة الدخل أ', 'min' => 0.0, 'max' => 400.0],
                ['key' => 'b', 'label' => 'فئة الدخل ب', 'min' => 400.01, 'max' => 600.0],
                ['key' => 'c', 'label' => 'فئة الدخل ج', 'min' => 600.01, 'max' => 800.0],
                ['key' => 'd', 'label' => 'فئة الدخل د', 'min' => 800.01, 'max' => $threshold],
            ], $section['bands'] ?? []),
        ];
    }

    public static function defaultScoring(array $section = [], array $incomeCategories = []): array
    {
        $maxScore = $section['max_score'] ?? self::DEFAULT_MAX_SCORE;
        $dimensions = $section['dimensions'] ?? [];

        $defaults = [
            'income' => ['enabled' => true, 'bands' => [
                ['min' => 0.0, 'max' => 400.0, 'points' => 15],
                ['min' => 400.01, 'max' => 600.0, 'points' => 11],
                ['min' => 600.01, 'max' => 800.0, 'points' => 7],
                ['min' => 800.01, 'max' => 1000.0, 'points' => 5],
                ['min' => 1000.01, 'max' => null, 'points' => 0],
            ]],
            'housing_condition' => ['enabled' => true, 'values' => [
                ['value' => 'poor', 'points' => 10],
                ['value' => 'average', 'points' => 5],
                ['value' => 'good', 'points' => 0],
            ]],
            'housing_tenure' => ['enabled' => true, 'values' => [
                ['value' => 'rented', 'points' => 10],
                ['value' => 'owned', 'points' => 0],
            ]],
            'head_health' => ['enabled' => true, 'bands' => [
                ['min' => 0.0, 'max' => 0.0, 'points' => 0],
                ['min' => 0.01, 'max' => 49.99, 'points' => 5],
                ['min' => 50.0, 'max' => 79.99, 'points' => 10],
                ['min' => 80.0, 'max' => 100.0, 'points' => 15],
            ]],
            'children_health' => ['enabled' => true, 'values' => [
                ['value' => 1, 'points' => 5],
                ['value' => 2, 'points' => 7],
                ['value' => 3, 'points' => 10],
            ]],
            'age' => ['enabled' => true, 'bands' => [
                ['min' => 30, 'max' => 39, 'points' => 0],
                ['min' => 40, 'max' => 49, 'points' => 5],
                ['min' => 50, 'max' => 59, 'points' => 10],
                ['min' => 60, 'max' => null, 'points' => 15],
            ]],
        ];

        $dimensionsOut = [];
        foreach (self::SCORING_DIMENSIONS as $dim) {
            $dimensionsOut[$dim] = array_merge($defaults[$dim], $dimensions[$dim] ?? []);
        }

        return [
            'max_score' => $maxScore,
            'dimensions' => $dimensionsOut,
        ];
    }

    public static function defaultScoreCategories(array $section = [], array $scoring = []): array
    {
        $maxScore = (int) ($scoring['max_score'] ?? self::DEFAULT_MAX_SCORE);

        return [
            'bands' => self::normalizeNumbers([
                ['key' => 'd', 'label' => 'فئة النقاط د', 'min' => 0, 'max' => 4],
                ['key' => 'c', 'label' => 'فئة النقاط ج', 'min' => 5, 'max' => 25],
                ['key' => 'b', 'label' => 'فئة النقاط ب', 'min' => 26, 'max' => 50],
                ['key' => 'a', 'label' => 'فئة النقاط أ', 'min' => 51, 'max' => $maxScore],
            ], $section['bands'] ?? []),
        ];
    }

    public static function defaultExceptions(array $section = [], array $incomeCategories = []): array
    {
        $ceiling = $section['rules'][0]['income_ceiling'] ?? self::DEFAULT_EXCEPTION_CEILING;

        $rules = $section['rules'] ?? [[
            'code' => 'orphan_mother',
            'enabled' => true,
            'label' => 'أم يتيم / أرملة مع أيتام',
            'income_ceiling' => $ceiling,
            'requires_manual_review' => true,
            // Default authoritative structured match is widow_with_orphans ONLY — a
            // generic 'widow' never auto-matches (orphan status is not provable from
            // the enum alone; POLICY-D supplies documentary proof).
            'condition' => ['field' => 'family_status', 'operator' => 'in', 'values' => ['widow_with_orphans']],
        ]];

        return ['rules' => $rules];
    }

    // ── Section validators ──────────────────────────────────────────────────

    public static function defaultDocuments(array $section = []): array
    {
        $defaults = [
            'rules' => [
                [
                    'code' => 'family_record',
                    'label' => 'سجل الأسرة المدني',
                    'required' => true,
                    'requires_verification' => false,
                    'allowed_document_types' => ['national_id', 'additional_document'],
                ],
                [
                    'code' => 'national_id',
                    'label' => 'الهوية الوطنية',
                    'required' => true,
                    'requires_verification' => true,
                    'allowed_document_types' => ['national_id'],
                ],
                [
                    'code' => 'electricity_bill',
                    'label' => 'فاتورة الكهرباء الأخيرة',
                    'required' => true,
                    'requires_verification' => false,
                    'allowed_document_types' => ['additional_document'],
                ],
                [
                    'code' => 'rental_contract',
                    'label' => 'عقد الإيجار (عند الاقتضاء)',
                    'required' => false,
                    'requires_verification' => false,
                    'allowed_document_types' => ['additional_document'],
                    'applies_when' => ['housing_type' => 'rented'],
                ],
                [
                    'code' => 'death_certificate',
                    'label' => 'شهادة وفاة الزوج (حالة الأرملة)',
                    'required' => false,
                    'requires_verification' => true,
                    'allowed_document_types' => ['additional_document'],
                    'applies_when' => ['family_status' => 'widow_with_orphans', 'family_status' => 'widow'],
                ],
                [
                    'code' => 'divorce_deed',
                    'label' => 'صك الطلاق (حالة المطلقة)',
                    'required' => false,
                    'requires_verification' => true,
                    'allowed_document_types' => ['additional_document'],
                    'applies_when' => ['family_status' => 'divorced', 'family_status' => 'divorced_with_children'],
                ],
                [
                    'code' => 'dependency_deed',
                    'label' => 'صك الإعالة / التبعية (عند الاقتضاء)',
                    'required' => false,
                    'requires_verification' => true,
                    'allowed_document_types' => ['additional_document'],
                    'applies_when' => ['family_status' => 'widow_with_orphans', 'family_status' => 'widow'],
                ],
                [
                    'code' => 'medical_evidence',
                    'label' => 'دليل طبي للإعاقة',
                    'required' => false,
                    'requires_verification' => true,
                    'allowed_document_types' => ['additional_document'],
                ],
                [
                    'code' => 'income_evidence',
                    'label' => 'إثبات دخل الأسرة حديث',
                    'required' => true,
                    'requires_verification' => false,
                    'allowed_document_types' => ['additional_document'],
                ],
            ],
        ];

        $rules = ($section['rules'] ?? null);
        if ($rules === null || $rules === []) {
            $rules = $defaults['rules'];
        }

        return ['rules' => $rules];
    }

    private static function validateDocuments(array $config): void
    {
        $documents = $config['documents'] ?? [];
        $rules = $documents['rules'] ?? [];
        if (! is_array($rules)) {
            throw ValidationException::withMessages([
                'configuration.documents.rules' => 'قواعد الوثائق يجب أن تكون مصفوفة.',
            ]);
        }
        $allowedCodes = ['family_record', 'national_id', 'electricity_bill', 'rental_contract', 'death_certificate', 'divorce_deed', 'dependency_deed', 'medical_evidence', 'income_evidence', 'service_area_document', 'bank_account_evidence', 'housing_condition_assessment'];
        foreach ($rules as $index => $rule) {
            if (! is_array($rule)) {
                throw ValidationException::withMessages([
                    "configuration.documents.rules.{$index}" => 'قاعدة وثيقة غير صالحة.',
                ]);
            }
            $code = $rule['code'] ?? null;
            if (! is_string($code) || ! in_array($code, $allowedCodes, true)) {
                throw ValidationException::withMessages([
                    "configuration.documents.rules.{$index}.code" => 'رمز وثيقة غير معروف: '.(string) $code,
                ]);
            }
            if (! is_string($rule['label'] ?? '')) {
                throw ValidationException::withMessages([
                    "configuration.documents.rules.{$index}.label" => 'عنوان الوثيقة مطلوب.',
                ]);
            }
            if (! is_bool($rule['required'] ?? false)) {
                throw ValidationException::withMessages([
                    "configuration.documents.rules.{$index}.required" => 'الحقل required يجب أن يكون قيمة منطقية.',
                ]);
            }
            if (! is_bool($rule['requires_verification'] ?? false)) {
                throw ValidationException::withMessages([
                    "configuration.documents.rules.{$index}.requires_verification" => 'الحقل requires_verification يجب أن يكون قيمة منطقية.',
                ]);
            }
        }
    }

    private static function validateFinancial(array $config): void
    {
        $financial = $config['financial'] ?? [];
        if (array_key_exists('per_family_member_deduction', $financial)) {
            $deduction = $financial['per_family_member_deduction'];
            if (! is_numeric($deduction) || (float) $deduction < 0) {
                throw ValidationException::withMessages([
                    'configuration.financial.per_family_member_deduction' => 'حسم الفرد من الأسرة يجب أن يكون رقماً غير سالب.',
                ]);
            }
        }
        if (array_key_exists('counted_income_sources', $financial)) {
            $sources = $financial['counted_income_sources'];
            if (! is_array($sources) || $sources === []) {
                throw ValidationException::withMessages([
                    'configuration.financial.counted_income_sources' => 'يجب اختيار مصدر دخل محتسب واحد على الأقل.',
                ]);
            }
            $invalid = array_values(array_diff($sources, self::INCOME_SOURCE_KEYS));
            if ($invalid !== []) {
                throw ValidationException::withMessages([
                    'configuration.financial.counted_income_sources' => 'مصدر دخل غير معروف: '.implode('، ', $invalid),
                ]);
            }
        }
        if (array_key_exists('rent_mode', $financial) && ! in_array($financial['rent_mode'], self::RENT_MODES, true)) {
            throw ValidationException::withMessages([
                'configuration.financial.rent_mode' => 'وضع الإيجار الشهري غير معروف; اختر annual_preference أو direct_monthly_preference.',
            ]);
        }
    }

    private static function validateEligibility(array $config): void
    {
        $review = $config['eligibility']['review'] ?? [];
        $unknownReview = array_values(array_diff(array_keys($review), array_keys(self::ELIGIBILITY_REVIEW_KEYS)));
        if ($unknownReview !== []) {
            throw ValidationException::withMessages([
                'configuration.eligibility.review' => 'بوابات مراجعة غير معروفة: '.implode('، ', $unknownReview),
            ]);
        }
        foreach ($review as $gate => $enabled) {
            if (! is_bool($enabled)) {
                throw ValidationException::withMessages([
                    "configuration.eligibility.review.{$gate}" => 'قيمة بوابة المراجعة يجب أن تكون منطقية (صح/خطأ).',
                ]);
            }
        }
    }

    private static function validateIncomeCategories(array $config): void
    {
        $income = $config['income_categories'] ?? [];
        $threshold = $income['exclusion_threshold'] ?? null;
        if ($threshold === null || ! is_numeric($threshold) || (float) $threshold < 0) {
            throw ValidationException::withMessages([
                'configuration.income_categories.exclusion_threshold' => 'حد الاستبعاد الدخلي يجب أن يكون رقماً غير سالب.',
            ]);
        }
        $thresholdCents = self::toCents((float) $threshold);

        $bands = $income['bands'] ?? null;
        if (! is_array($bands) || $bands === []) {
            throw ValidationException::withMessages([
                'configuration.income_categories.bands' => 'يجب تحديد نطاقات فئات الدخل (أ–د).',
            ]);
        }

        $keys = [];
        $prevMaxCents = null;
        $lastMaxCents = null;
        foreach ($bands as $index => $band) {
            if (! is_array($band)) {
                throw ValidationException::withMessages([
                    "configuration.income_categories.bands.{$index}" => 'نطاق فئة غير صالح.',
                ]);
            }
            $key = $band['key'] ?? null;
            if (! is_string($key) || ! in_array($key, self::INCOME_CATEGORY_KEYS, true)) {
                throw ValidationException::withMessages([
                    "configuration.income_categories.bands.{$index}.key" => 'رمز فئة غير معروف; استخدم a,b,c,d.',
                ]);
            }
            if (in_array($key, $keys, true)) {
                throw ValidationException::withMessages([
                    "configuration.income_categories.bands.{$index}.key" => "فئة مكررة: {$key}.",
                ]);
            }
            $keys[] = $key;

            $label = $band['label'] ?? '';
            if (! is_string($label) || trim($label) === '') {
                throw ValidationException::withMessages([
                    "configuration.income_categories.bands.{$index}.label" => 'يجب إدخال مسمى الفئة.',
                ]);
            }

            $min = $band['min'] ?? null;
            $max = $band['max'] ?? null;
            if (! is_numeric($min) || ! is_numeric($max)) {
                throw ValidationException::withMessages([
                    "configuration.income_categories.bands.{$index}" => 'حدود الفئة يجب أن تكون أرقاماً.',
                ]);
            }
            $minCents = self::toCents((float) $min);
            $maxCents = self::toCents((float) $max);
            if ($minCents < 0 || $maxCents < 0) {
                throw ValidationException::withMessages([
                    "configuration.income_categories.bands.{$index}" => 'حدود الفئة لا يمكن أن تكون سالبة.',
                ]);
            }
            if ($minCents > $maxCents) {
                throw ValidationException::withMessages([
                    "configuration.income_categories.bands.{$index}" => 'الحد الأدنى لا يمكن أن يتجاوز الحد الأعلى.',
                ]);
            }
            if ($index === 0 && $minCents !== 0) {
                throw ValidationException::withMessages([
                    'configuration.income_categories.bands' => 'يجب أن يبدأ النطاق الأول من صفر.',
                ]);
            }
            if ($prevMaxCents !== null && $minCents !== $prevMaxCents + 1) {
                throw ValidationException::withMessages([
                    'configuration.income_categories.bands' => 'نطاقات فئات الدخل يجب أن تكون متجاورة دون تداخل أو فجوات (فرق 0.01).',
                ]);
            }
            $prevMaxCents = $maxCents;
            $lastMaxCents = $maxCents;
        }

        if ($lastMaxCents !== $thresholdCents) {
            throw ValidationException::withMessages([
                'configuration.income_categories.bands' => 'أعلى نطاق لفئات الدخل يجب أن يبلغ حد الاستبعاد المحدد ('.number_format($threshold, 2).') بالضبط.',
            ]);
        }
    }

    private static function validateScoring(array $config): void
    {
        $scoring = $config['scoring'] ?? [];
        $maxScoreRaw = $scoring['max_score'] ?? self::DEFAULT_MAX_SCORE;
        if (! is_numeric($maxScoreRaw) || (int) $maxScoreRaw < 0 || (float) $maxScoreRaw !== floor((float) $maxScoreRaw)) {
            throw ValidationException::withMessages([
                'configuration.scoring.max_score' => 'الحد الأقصى للنقاط يجب أن يكون عدداً صحيحاً غير سالب.',
            ]);
        }
        $maxScore = (int) $maxScoreRaw;

        $dimensions = $scoring['dimensions'] ?? null;
        if (! is_array($dimensions)) {
            throw ValidationException::withMessages([
                'configuration.scoring.dimensions' => 'يجب تعريف أبعاد النقاط.',
            ]);
        }
        $unknownDims = array_values(array_diff(array_keys($dimensions), self::SCORING_DIMENSIONS));
        if ($unknownDims !== []) {
            throw ValidationException::withMessages([
                'configuration.scoring.dimensions' => 'بعد نقاط غير معروف: '.implode('، ', $unknownDims),
            ]);
        }

        $maxAchievable = 0;
        foreach (self::SCORING_DIMENSIONS as $dim) {
            if (! isset($dimensions[$dim]) || ! is_array($dimensions[$dim])) {
                throw ValidationException::withMessages([
                    "configuration.scoring.dimensions.{$dim}" => 'يجب تعريف بعد النقاط.',
                ]);
            }
            $enabled = $dimensions[$dim]['enabled'] ?? true;
            if (! is_bool($enabled)) {
                throw ValidationException::withMessages([
                    "configuration.scoring.dimensions.{$dim}.enabled" => 'قيمة تفعيل البعد يجب أن تكون منطقية (صح/خطأ).',
                ]);
            }
            $dimMax = self::validateScoringDimension($dim, $dimensions[$dim]);
            if ($enabled) {
                $maxAchievable += $dimMax;
            }
        }

        if ($maxAchievable > $maxScore) {
            throw ValidationException::withMessages([
                'configuration.scoring' => "مجموع الحدود القصوى لأبعاد النقاط ({$maxAchievable}) يتجاوز الحد الأقصى المسموح ({$maxScore}).",
            ]);
        }
    }

    /** @return int max achievable points of the dimension */
    private static function validateScoringDimension(string $dimension, array $dim): int
    {
        $points = $dim['points'] ?? null;
        $values = $dim['values'] ?? null;
        $bands = $dim['bands'] ?? null;

        if (in_array($dimension, ['housing_condition', 'housing_tenure', 'children_health'], true)) {
            if (! is_array($values) || $values === []) {
                throw ValidationException::withMessages([
                    "configuration.scoring.dimensions.{$dimension}.values" => 'يجب تعريف قيم النقاط للبعد.',
                ]);
            }
            $seen = [];
            $maxPoints = 0;
            foreach ($values as $index => $row) {
                if (! is_array($row)) {
                    throw ValidationException::withMessages([
                        "configuration.scoring.dimensions.{$dimension}.values.{$index}" => 'قيمة نقاط غير صالحة.',
                    ]);
                }
                $value = $row['value'] ?? null;
                $rowPoints = $row['points'] ?? null;
                if ($dimension === 'children_health') {
                    if (! is_int($value) && ! (is_numeric($value) && (float) $value === floor((float) $value))) {
                        throw ValidationException::withMessages([
                            "configuration.scoring.dimensions.{$dimension}.values.{$index}.value" => 'عدد الأطفال المتأثرين يجب أن يكون عدداً صحيحاً موجباً.',
                        ]);
                    }
                    $valueKey = (string) (int) $value;
                    if ((int) $value < 1) {
                        throw ValidationException::withMessages([
                            "configuration.scoring.dimensions.{$dimension}.values.{$index}.value" => 'عدد الأطفال المتأثرين يجب أن يكون 1 فأكثر.',
                        ]);
                    }
                } else {
                    if (! is_string($value) || $value === '') {
                        throw ValidationException::withMessages([
                            "configuration.scoring.dimensions.{$dimension}.values.{$index}.value" => 'قيمة غير صالحة.',
                        ]);
                    }
                    $valueKey = $value;
                }
                if (isset($seen[$valueKey])) {
                    throw ValidationException::withMessages([
                        "configuration.scoring.dimensions.{$dimension}.values" => 'قيم مكررة في بعد النقاط.',
                    ]);
                }
                $seen[$valueKey] = true;
                if (! is_numeric($rowPoints) || (float) $rowPoints < 0) {
                    throw ValidationException::withMessages([
                        "configuration.scoring.dimensions.{$dimension}.values.{$index}.points" => 'النقاط يجب أن تكون رقماً غير سالب.',
                    ]);
                }
                $maxPoints = max($maxPoints, (int) $rowPoints);
            }

            return $maxPoints;
        }

        // band-based dimensions: income (money, open top) / head_health (percent 0–100) / age (integer)
        if (! is_array($bands) || $bands === []) {
            throw ValidationException::withMessages([
                "configuration.scoring.dimensions.{$dimension}.bands" => 'يجب تعريف نطاقات النقاط للبعد.',
            ]);
        }

        $prevMaxCents = null;
        $hasOpenTop = false;
        $maxPoints = 0;
        $isAge = $dimension === 'age';
        foreach ($bands as $index => $row) {
            if (! is_array($row)) {
                throw ValidationException::withMessages([
                    "configuration.scoring.dimensions.{$dimension}.bands.{$index}" => 'نطاق نقاط غير صالح.',
                ]);
            }
            $min = $row['min'] ?? null;
            $hasMax = array_key_exists('max', $row) && $row['max'] !== null;
            $max = $hasMax ? $row['max'] : null;
            $rowPoints = $row['points'] ?? null;

            if (! is_numeric($min) || (float) $min < 0) {
                throw ValidationException::withMessages([
                    "configuration.scoring.dimensions.{$dimension}.bands.{$index}.min" => 'الحد الأدنى يجب أن يكون رقماً غير سالب.',
                ]);
            }
            $minCents = self::toCents((float) $min);
            if ($hasMax) {
                if (! is_numeric($max) || (float) $max < (float) $min) {
                    throw ValidationException::withMessages([
                        "configuration.scoring.dimensions.{$dimension}.bands.{$index}.max" => 'الحد الأعلى يجب أن يكون رقماً يساوي أو يفوق الحد الأدنى.',
                    ]);
                }
                $maxCents = self::toCents((float) $max);
            } else {
                if ($hasOpenTop) {
                    throw ValidationException::withMessages([
                        "configuration.scoring.dimensions.{$dimension}.bands" => 'لا يمكن أن يكون هناك أكثر من نطاق مفتوح (بدون حد أعلى).',
                    ]);
                }
                $maxCents = null;
                $hasOpenTop = true;
            }
            if (! is_numeric($rowPoints) || (float) $rowPoints < 0) {
                throw ValidationException::withMessages([
                    "configuration.scoring.dimensions.{$dimension}.bands.{$index}.points" => 'النقاط يجب أن تكون رقماً غير سالب.',
                ]);
            }
            if ($prevMaxCents !== null && $minCents !== $prevMaxCents + ($isAge ? 100 : 1)) {
                throw ValidationException::withMessages([
                    "configuration.scoring.dimensions.{$dimension}.bands" => 'نطاقات النقاط يجب أن تكون متجاورة دون تداخل أو فجوات.',
                ]);
            }
            $prevMaxCents = $maxCents;
            $maxPoints = max($maxPoints, (int) $rowPoints);
        }

        if ($dimension === 'income' && (self::toCents((float) ($bands[0]['min'] ?? null)) ?? null) !== 0) {
            throw ValidationException::withMessages([
                'configuration.scoring.dimensions.income.bands' => 'يجب أن يبدأ نطاق دخل النقاط من صفر.',
            ]);
        }
        if ($dimension === 'income' && ! $hasOpenTop) {
            throw ValidationException::withMessages([
                'configuration.scoring.dimensions.income.bands' => 'يجب أن يغطي بعد الدخل كل القيم عبر نطاق مفتوح في الأعلى.',
            ]);
        }
        if ($dimension === 'head_health' && ($prevMaxCents ?? -1) !== 10000) {
            throw ValidationException::withMessages([
                'configuration.scoring.dimensions.head_health.bands' => 'نسبة الإعاقة يجب أن تغطي النطاق 0–100 بالكامل بدون فجوات.',
            ]);
        }

        return $maxPoints;
    }

    private static function validateScoreCategories(array $config): void
    {
        $maxScore = (int) ($config['scoring']['max_score'] ?? self::DEFAULT_MAX_SCORE);
        $bands = $config['score_categories']['bands'] ?? null;
        if (! is_array($bands) || $bands === []) {
            throw ValidationException::withMessages([
                'configuration.score_categories.bands' => 'يجب تحديد نطاقات فئات النقاط.',
            ]);
        }

        $keys = [];
        $prevMax = null;
        $lastMax = null;
        foreach ($bands as $index => $band) {
            if (! is_array($band)) {
                throw ValidationException::withMessages([
                    "configuration.score_categories.bands.{$index}" => 'نطاق غير صالح.',
                ]);
            }
            $key = $band['key'] ?? null;
            if (! is_string($key) || ! in_array($key, self::SCORE_CATEGORY_KEYS, true)) {
                throw ValidationException::withMessages([
                    "configuration.score_categories.bands.{$index}.key" => 'رمز فئة نقاط غير معروف; استخدم a,b,c,d.',
                ]);
            }
            if (in_array($key, $keys, true)) {
                throw ValidationException::withMessages([
                    "configuration.score_categories.bands.{$index}.key" => "فئة مكررة: {$key}.",
                ]);
            }
            $keys[] = $key;

            $label = $band['label'] ?? '';
            if (! is_string($label) || trim($label) === '') {
                throw ValidationException::withMessages([
                    "configuration.score_categories.bands.{$index}.label" => 'يجب إدخال مسمى الفئة.',
                ]);
            }

            $min = $band['min'] ?? null;
            $max = $band['max'] ?? null;
            if (! is_numeric($min) || ! is_numeric($max) || (float) $min !== floor((float) $min) || (float) $max !== floor((float) $max)) {
                throw ValidationException::withMessages([
                    "configuration.score_categories.bands.{$index}" => 'حدود الفئات يجب أن تكون أعداداً صحيحة.',
                ]);
            }
            $minI = (int) $min;
            $maxI = (int) $max;
            if ($minI < 0 || $maxI < 0) {
                throw ValidationException::withMessages([
                    "configuration.score_categories.bands.{$index}" => 'حدود الفئات لا يمكن أن تكون سالبة.',
                ]);
            }
            if ($minI > $maxI) {
                throw ValidationException::withMessages([
                    "configuration.score_categories.bands.{$index}" => 'الحد الأدنى لا يمكن أن يتجاوز الحد الأعلى.',
                ]);
            }
            if ($maxI > $maxScore) {
                throw ValidationException::withMessages([
                    "configuration.score_categories.bands.{$index}" => "نطاق فئة النقاط ({$maxI}) يتجاوز الحد الأقصى المسموح ({$maxScore}).",
                ]);
            }
            if ($index === 0 && $minI !== 0) {
                throw ValidationException::withMessages([
                    'configuration.score_categories.bands' => 'يجب أن يبدأ النطاق الأول لفئات النقاط من صفر.',
                ]);
            }
            if ($prevMax !== null && $minI !== $prevMax + 1) {
                throw ValidationException::withMessages([
                    'configuration.score_categories.bands' => 'نطاقات فئات النقاط يجب أن تكون متجاورة دون تداخل أو فجوات.',
                ]);
            }
            $prevMax = $maxI;
            $lastMax = $maxI;
        }

        if ($lastMax !== $maxScore) {
            throw ValidationException::withMessages([
                'configuration.score_categories.bands' => "أعلى نطاق لفئات النقاط يجب أن يبلغ الحد الأقصى للنقاط ({$maxScore}).",
            ]);
        }
    }

    private static function validateExceptions(array $config): void
    {
        $rules = $config['exceptions']['rules'] ?? null;
        if (! is_array($rules) || $rules === []) {
            throw ValidationException::withMessages([
                'configuration.exceptions.rules' => 'يجب تعريف استثناء واحد على الأقل ضمن قائمة الاستثناءات.',
            ]);
        }
        $threshold = (float) ($config['income_categories']['exclusion_threshold'] ?? self::DEFAULT_INCOME_EXCLUSION_THRESHOLD);

        $codes = [];
        foreach ($rules as $index => $rule) {
            if (! is_array($rule)) {
                throw ValidationException::withMessages([
                    "configuration.exceptions.rules.{$index}" => 'قاعدة استثناء غير صالحة.',
                ]);
            }
            $code = $rule['code'] ?? null;
            if (! is_string($code) || ! in_array($code, self::EXCEPTION_CODES, true)) {
                throw ValidationException::withMessages([
                    "configuration.exceptions.rules.{$index}.code" => 'رمز استثناء غير معروف: '.($code ?? ''),
                ]);
            }
            if (in_array($code, $codes, true)) {
                throw ValidationException::withMessages([
                    "configuration.exceptions.rules.{$index}.code" => "قاعدة استثناء مكررة: {$code}.",
                ]);
            }
            $codes[] = $code;

            if (! isset($rule['enabled']) || ! is_bool($rule['enabled'])) {
                throw ValidationException::withMessages([
                    "configuration.exceptions.rules.{$index}.enabled" => 'قيمة تفعيل الاستثناء يجب أن تكون منطقية (صح/خطأ).',
                ]);
            }
            $label = $rule['label'] ?? '';
            if (! is_string($label) || trim($label) === '') {
                throw ValidationException::withMessages([
                    "configuration.exceptions.rules.{$index}.label" => 'يجب إدخال مسمى الاستثناء.',
                ]);
            }
            $ceiling = $rule['income_ceiling'] ?? null;
            if (! is_numeric($ceiling) || (float) $ceiling <= 0) {
                throw ValidationException::withMessages([
                    "configuration.exceptions.rules.{$index}.income_ceiling" => 'سقف دخل الاستثناء يجب أن يكون رقماً موجباً.',
                ]);
            }
            if ((float) $ceiling <= $threshold) {
                throw ValidationException::withMessages([
                    "configuration.exceptions.rules.{$index}.income_ceiling" => 'سقف دخل الاستثناء يجب أن يتجاوز حد الاستبعاد الدخلي.',
                ]);
            }
            if (! isset($rule['requires_manual_review']) || ! is_bool($rule['requires_manual_review'])) {
                throw ValidationException::withMessages([
                    "configuration.exceptions.rules.{$index}.requires_manual_review" => 'قيمة المراجعة اليدوية يجب أن تكون منطقية (صح/خطأ).',
                ]);
            }
            $condition = $rule['condition'] ?? null;
            if (! is_array($condition)) {
                throw ValidationException::withMessages([
                    "configuration.exceptions.rules.{$index}.condition" => 'يجب تعريف شرط الاستثناء بشكل بنيوي.',
                ]);
            }
            $field = $condition['field'] ?? null;
            if (! in_array($field, self::EXCEPTION_CONDITION_FIELDS, true)) {
                throw ValidationException::withMessages([
                    "configuration.exceptions.rules.{$index}.condition.field" => 'حقل شرط غير معروف.',
                ]);
            }
            $operator = $condition['operator'] ?? null;
            if (! in_array($operator, self::EXCEPTION_CONDITION_OPERATORS, true)) {
                throw ValidationException::withMessages([
                    "configuration.exceptions.rules.{$index}.condition.operator" => 'عامل شرط غير معروف.',
                ]);
            }
            $values = $condition['values'] ?? null;
            if (! is_array($values) || $values === [] || array_values(array_diff($values, self::FAMILY_STATUS_VALUES)) !== []) {
                throw ValidationException::withMessages([
                    "configuration.exceptions.rules.{$index}.condition.values" => 'قيم شرط حالة الأسرة غير صالحة.',
                ]);
            }
        }
    }

    private static function validateApplicationScope(array $config): void
    {
        $scope = $config['application_scope'] ?? [];
        if (array_key_exists('applies_to', $scope) && ! in_array($scope['applies_to'], self::APPLICATION_SCOPES, true)) {
            throw ValidationException::withMessages([
                'configuration.application_scope.applies_to' => 'نطاق التطبيق غير معروف: '.($scope['applies_to'] ?? ''),
            ]);
        }

        // POLICY-E1: application_scope owns ONLY the mode and (for
        // effective_from_date) the canonical effective date. Selected existing
        // beneficiary IDs are run-level parameters, never policy configuration.
        $unknown = array_values(array_diff(array_keys($scope), ['applies_to', 'effective_from_date']));
        if ($unknown !== []) {
            throw ValidationException::withMessages([
                'configuration.application_scope' => 'حقول غير معروفة في نطاق التطبيق: '.implode('، ', $unknown),
            ]);
        }

        $mode = $scope['applies_to'] ?? self::DEFAULT_APPLIES_TO;
        $hasDate = array_key_exists('effective_from_date', $scope);
        if ($mode === 'effective_from_date') {
            if (! $hasDate || ! self::isCanonicalDate($scope['effective_from_date'])) {
                throw ValidationException::withMessages([
                    'configuration.application_scope.effective_from_date' => 'نطاق «effective_from_date» يتطلب تاريخ نفاذ صالحاً بصيغة YYYY-MM-DD.',
                ]);
            }
        } elseif ($hasDate) {
            throw ValidationException::withMessages([
                'configuration.application_scope.effective_from_date' => 'تاريخ النفاذ مسموح فقط مع نطاق «effective_from_date».',
            ]);
        }
    }

    /**
     * Canonical policy date: exact YYYY-MM-DD calendar date (POLICY-E1).
     */
    public static function isCanonicalDate(mixed $value): bool
    {
        if (! is_string($value) || ! preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
            return false;
        }
        $date = \DateTimeImmutable::createFromFormat('!Y-m-d', $value);

        return $date !== false && $date->format('Y-m-d') === $value;
    }

    /**
     * Merge provided bands/rules ONLY when the custom list is present; otherwise keep defaults.
     */
    private static function normalizeNumbers(array $defaults, array $provided): array
    {
        if ($provided === []) {
            return $defaults;
        }

        return $provided;
    }

    /**
     * Deterministic integer-cents conversion — monetary/percent boundaries are
     * always compared as integers, never as floats.
     */
    public static function toCents(float $value): int
    {
        return (int) round($value * 100);
    }

    /**
     * Generic shape guard: identifier-safe keys, bounded depth, scalar leaves.
     */
    private static function assertShape(array $value, string $path, int $depth): void
    {
        foreach ($value as $key => $child) {
            // Sequential list items (e.g. counted_income_sources) are allowed.
            if (is_int($key)) {
                if (is_array($child)) {
                    if ($depth >= self::MAX_DEPTH) {
                        throw ValidationException::withMessages([
                            "{$path}[{$key}]" => 'عمق التهيئة يتجاوز الحد المسموح.',
                        ]);
                    }
                    self::assertShape($child, "{$path}[{$key}]", $depth + 1);
                } elseif (! is_scalar($child) && $child !== null) {
                    throw ValidationException::withMessages([
                        "{$path}[{$key}]" => 'القيم غير الصحيحة غير مسموحة داخل الإعدادات.',
                    ]);
                }

                continue;
            }
            if (! is_string($key) || ! preg_match(self::KEY_PATTERN, $key)) {
                throw ValidationException::withMessages([
                    $path => "مفتاح غير صالح: {$key}",
                ]);
            }
            if (is_array($child)) {
                if ($depth >= self::MAX_DEPTH) {
                    throw ValidationException::withMessages([
                        "{$path}.{$key}" => 'عمق التهيئة يتجاوز الحد المسموح.',
                    ]);
                }
                self::assertShape($child, "{$path}.{$key}", $depth + 1);
            } elseif (! is_scalar($child) && $child !== null) {
                throw ValidationException::withMessages([
                    "{$path}.{$key}" => 'القيم غير الصحيحة غير مسموحة داخل الإعدادات.',
                ]);
            }
        }
    }
}
