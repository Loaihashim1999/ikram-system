<?php

namespace Tests\Feature;

use App\Models\Beneficiary;
use App\Models\BeneficiaryPolicyVersion;
use App\Models\User;
use App\Services\BeneficiaryPolicy\BeneficiaryPolicyVersionService;
use App\Services\BeneficiaryPolicy\PolicyConfigurationValidator;
use App\Services\BeneficiaryPolicy\PolicyFinancialEvaluationService;
use App\Services\BeneficiaryPolicy\PolicyScoringInputProvider;
use App\Services\BeneficiaryPolicy\PolicyScoringInputs;
use App\Services\BeneficiaryPolicy\PolicyScoringService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * POLICY-C — point scoring engine, totals, score categories & separation
 * (authorization mandate tests 14–63).
 */
class PolicyCScoringAndCategoriesTest extends TestCase
{
    use RefreshDatabase;

    protected BeneficiaryPolicyVersionService $versions;

    protected PolicyFinancialEvaluationService $evaluator;

    protected PolicyScoringService $scoring;

    protected int $nationalSeq = 0;

    protected User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->versions = app(BeneficiaryPolicyVersionService::class);
        $this->evaluator = app(PolicyFinancialEvaluationService::class);
        $this->scoring = app(PolicyScoringService::class);
        $this->admin = User::create([
            'username' => 'TEST_POLICYC_SCORE', 'full_name' => 'Policy C Scoring Admin',
            'password' => 'test-password', 'email' => 'policyc-score@example.invalid',
            'role' => 'admin', 'is_active' => true,
        ]);
        Sanctum::actingAs($this->admin);
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    protected function defaults(): array
    {
        return PolicyConfigurationValidator::withDefaults([]);
    }

    protected function score(array $inputs): array
    {
        $config = $this->defaults();

        return $this->scoring->score(
            PolicyScoringInputs::fromStructured($inputs),
            $config['scoring'],
            $config['score_categories'],
        );
    }

    protected function comp(array $result, string $dimension): array
    {
        foreach ($result['components'] as $component) {
            if ($component['dimension'] === $dimension) {
                return $component;
            }
        }
        $this->fail("missing component {$dimension}");
    }

    protected function makeBeneficiary(array $overrides = []): Beneficiary
    {
        $seq = ++$this->nationalSeq;

        return Beneficiary::create(array_merge([
            'beneficiary_type' => 'citizen',
            'full_name' => 'مواطن تجريبي',
            'national_id' => '1'.str_pad((string) $seq, 9, '0', STR_PAD_LEFT),
            'phone' => '05'.str_pad((string) $seq, 8, '0', STR_PAD_LEFT),
            'date_of_birth' => '1980-05-05',
            'family_status' => 'poor',
            'family_members_count' => 1,
            'housing_type' => 'own',
            'income_sources' => ['salary'],
            'monthly_salary' => 1000,
            'social_security_amount' => 0,
            'citizen_account_amount' => 0,
            'retirement_pension' => 0,
            'family_support' => 0,
            'status' => 'active',
        ], $overrides));
    }

    protected function makeVersion(array $config = [], array $overrides = []): BeneficiaryPolicyVersion
    {
        return BeneficiaryPolicyVersion::create(array_merge([
            'policy_name' => 'سياسة صرف المساعدات للمستفيدين',
            'policy_scope' => 'citizen_beneficiaries',
            'version' => (string) mt_rand(1000, 9999),
            'effective_from' => '2026-10-01',
            'configuration' => $config,
        ], $overrides));
    }

    protected function publishVersion(array $config = [], array $overrides = []): BeneficiaryPolicyVersion
    {
        $version = $this->makeVersion($config, $overrides);
        $this->versions->approve($version->id, ['board_approval_reference' => 'قرار 1/2026', 'board_approval_date' => '2026-09-20'], $this->admin->id);
        $this->versions->publish($version->id, $this->admin->id);

        return $version->fresh();
    }

    // ── 14–18: INCOME POINTS ───────────────────────────────────────────────

    public function test_income_a_range_gives_15_points(): void
    {
        $this->assertSame(15.0, $this->comp($this->score(['income_per_capita' => 0.0]), 'income')['points']);
        $this->assertSame(15.0, $this->comp($this->score(['income_per_capita' => 400.0]), 'income')['points']);
    }

    public function test_income_b_range_gives_11_points(): void
    {
        $this->assertSame(11.0, $this->comp($this->score(['income_per_capita' => 400.01]), 'income')['points']);
        $this->assertSame(11.0, $this->comp($this->score(['income_per_capita' => 600.0]), 'income')['points']);
    }

    public function test_income_c_range_gives_7_points(): void
    {
        $this->assertSame(7.0, $this->comp($this->score(['income_per_capita' => 600.01]), 'income')['points']);
        $this->assertSame(7.0, $this->comp($this->score(['income_per_capita' => 800.0]), 'income')['points']);
    }

    public function test_income_d_range_gives_5_points(): void
    {
        $this->assertSame(5.0, $this->comp($this->score(['income_per_capita' => 800.01]), 'income')['points']);
        $this->assertSame(5.0, $this->comp($this->score(['income_per_capita' => 1000.0]), 'income')['points']);
    }

    public function test_income_above_1000_gives_zero_points(): void
    {
        $component = $this->comp($this->score(['income_per_capita' => 1000.01]), 'income');
        $this->assertSame(0.0, $component['points']);
        $this->assertFalse($component['review_required']);
    }

    // ── 19–22: HOUSING CONDITION ───────────────────────────────────────────

    public function test_housing_poor_gives_10_points(): void
    {
        $this->assertSame(10.0, $this->comp($this->score(['income_per_capita' => 0.0, 'housing_condition' => 'poor']), 'housing_condition')['points']);
    }

    public function test_housing_average_gives_5_points(): void
    {
        $this->assertSame(5.0, $this->comp($this->score(['income_per_capita' => 0.0, 'housing_condition' => 'average']), 'housing_condition')['points']);
    }

    public function test_housing_good_gives_zero_points(): void
    {
        $component = $this->comp($this->score(['income_per_capita' => 0.0, 'housing_condition' => 'good']), 'housing_condition');
        $this->assertSame(0.0, $component['points']);
        $this->assertFalse($component['review_required']);
    }

    public function test_unknown_housing_condition_review_required(): void
    {
        $missing = $this->comp($this->score(['income_per_capita' => 0.0]), 'housing_condition');
        $this->assertTrue($missing['review_required']);
        $this->assertNull($missing['points']);
        $this->assertSame(PolicyScoringService::REASON_HOUSING_CONDITION_REVIEW, $missing['reason']);

        // Free-text / unapproved value is never scored silently.
        $unmapped = $this->comp($this->score(['income_per_capita' => 0.0, 'housing_condition' => 'very_bad']), 'housing_condition');
        $this->assertTrue($unmapped['review_required']);
        $this->assertNull($unmapped['points']);
    }

    // ── 23–25: HOUSING TENURE ──────────────────────────────────────────────

    public function test_tenure_rented_gives_10_points(): void
    {
        $this->assertSame(10.0, $this->comp($this->score(['income_per_capita' => 0.0, 'housing_tenure' => 'rented']), 'housing_tenure')['points']);
    }

    public function test_tenure_owned_gives_zero_points(): void
    {
        $component = $this->comp($this->score(['income_per_capita' => 0.0, 'housing_tenure' => 'owned']), 'housing_tenure');
        $this->assertSame(0.0, $component['points']);
        $this->assertFalse($component['review_required']);
    }

    public function test_unsupported_tenure_review_required(): void
    {
        $missing = $this->comp($this->score(['income_per_capita' => 0.0]), 'housing_tenure');
        $this->assertTrue($missing['review_required']);
        $this->assertSame(PolicyScoringService::REASON_HOUSING_TENURE_REVIEW, $missing['reason']);

        $unmapped = $this->comp($this->score(['income_per_capita' => 0.0, 'housing_tenure' => 'lease']), 'housing_tenure');
        $this->assertTrue($unmapped['review_required']);
    }

    // ── 26–34: HEAD HEALTH / DISABILITY ────────────────────────────────────

    public function test_disability_100_gives_15_points(): void
    {
        $this->assertSame(15.0, $this->comp($this->score(['income_per_capita' => 0.0, 'head_disability_percent' => 100.0]), 'head_health')['points']);
    }

    public function test_disability_80_gives_15_points(): void
    {
        $this->assertSame(15.0, $this->comp($this->score(['income_per_capita' => 0.0, 'head_disability_percent' => 80.0]), 'head_health')['points']);
    }

    public function test_disability_79_99_gives_10_points(): void
    {
        $this->assertSame(10.0, $this->comp($this->score(['income_per_capita' => 0.0, 'head_disability_percent' => 79.99]), 'head_health')['points']);
    }

    public function test_disability_50_gives_10_points(): void
    {
        $this->assertSame(10.0, $this->comp($this->score(['income_per_capita' => 0.0, 'head_disability_percent' => 50.0]), 'head_health')['points']);
    }

    public function test_disability_below_50_gives_5_points(): void
    {
        $this->assertSame(5.0, $this->comp($this->score(['income_per_capita' => 0.0, 'head_disability_percent' => 49.99]), 'head_health')['points']);
        $this->assertSame(5.0, $this->comp($this->score(['income_per_capita' => 0.0, 'head_disability_percent' => 0.01]), 'head_health')['points']);
    }

    public function test_disability_zero_healthy_gives_zero_points(): void
    {
        $component = $this->comp($this->score(['income_per_capita' => 0.0, 'head_disability_percent' => 0.0]), 'head_health');
        $this->assertSame(0.0, $component['points']);
        $this->assertFalse($component['review_required']);
    }

    public function test_negative_disability_rejected(): void
    {
        $this->expectException(ValidationException::class);
        $this->score(['income_per_capita' => 0.0, 'head_disability_percent' => -0.01]);
    }

    public function test_disability_above_100_rejected(): void
    {
        $this->expectException(ValidationException::class);
        $this->score(['income_per_capita' => 0.0, 'head_disability_percent' => 100.01]);
    }

    public function test_disability_valid_range_is_exactly_0_to_100_inclusive(): void
    {
        // Authoritative range is EXACTLY 0 <= disability_percentage <= 100 — no
        // tolerance window such as [-0.01, 100.01]; deterministic cent comparisons.
        $zero = $this->comp($this->score(['income_per_capita' => 0.0, 'head_disability_percent' => 0.0]), 'head_health');
        $this->assertFalse($zero['review_required']);
        $this->assertSame(0.0, $zero['points']);

        $hundred = $this->comp($this->score(['income_per_capita' => 0.0, 'head_disability_percent' => 100.0]), 'head_health');
        $this->assertSame(15.0, $hundred['points']);

        foreach ([-0.01, 100.01] as $invalid) {
            try {
                $this->score(['income_per_capita' => 0.0, 'head_disability_percent' => $invalid]);
                $this->fail("disability percentage {$invalid} must be rejected (valid range is exactly 0–100).");
            } catch (ValidationException) {
                $this->addToAssertionCount(1);
            }
        }
    }

    public function test_missing_disability_data_review_required(): void
    {
        $component = $this->comp($this->score(['income_per_capita' => 0.0]), 'head_health');
        $this->assertTrue($component['review_required']);
        $this->assertNull($component['points']);
        $this->assertSame(PolicyScoringService::REASON_HEAD_HEALTH_REVIEW, $component['reason']);
    }

    // ── 35–38: CHILDREN HEALTH ─────────────────────────────────────────────

    public function test_one_affected_child_gives_5_points(): void
    {
        $this->assertSame(5.0, $this->comp($this->score(['income_per_capita' => 0.0, 'affected_children_count' => 1]), 'children_health')['points']);
    }

    public function test_two_affected_children_give_7_points(): void
    {
        $this->assertSame(7.0, $this->comp($this->score(['income_per_capita' => 0.0, 'affected_children_count' => 2]), 'children_health')['points']);
    }

    public function test_three_affected_children_give_10_points(): void
    {
        $this->assertSame(10.0, $this->comp($this->score(['income_per_capita' => 0.0, 'affected_children_count' => 3]), 'children_health')['points']);
    }

    public function test_more_than_three_affected_children_review_required(): void
    {
        // >3 affected children have NO authoritative source rule (audit §5) → review.
        $component = $this->comp($this->score(['income_per_capita' => 0.0, 'affected_children_count' => 4]), 'children_health');
        $this->assertTrue($component['review_required']);
        $this->assertNull($component['points']);
        $this->assertSame(PolicyScoringService::REASON_CHILDREN_HEALTH_REVIEW, $component['reason']);

        // zero affected children IS data → policy-defined zero, not a review.
        $zero = $this->comp($this->score(['income_per_capita' => 0.0, 'affected_children_count' => 0]), 'children_health');
        $this->assertFalse($zero['review_required']);
        $this->assertSame(0.0, $zero['points']);
    }

    // ── 39–44: AGE ─────────────────────────────────────────────────────────

    public function test_age_60_gives_15_points(): void
    {
        $this->assertSame(15.0, $this->comp($this->score(['income_per_capita' => 0.0, 'head_age' => 60]), 'age')['points']);
        $this->assertSame(15.0, $this->comp($this->score(['income_per_capita' => 0.0, 'head_age' => 80]), 'age')['points']);
    }

    public function test_age_50_to_59_gives_10_points(): void
    {
        $this->assertSame(10.0, $this->comp($this->score(['income_per_capita' => 0.0, 'head_age' => 50]), 'age')['points']);
        $this->assertSame(10.0, $this->comp($this->score(['income_per_capita' => 0.0, 'head_age' => 59]), 'age')['points']);
    }

    public function test_age_40_to_49_gives_5_points(): void
    {
        $this->assertSame(5.0, $this->comp($this->score(['income_per_capita' => 0.0, 'head_age' => 40]), 'age')['points']);
        $this->assertSame(5.0, $this->comp($this->score(['income_per_capita' => 0.0, 'head_age' => 49]), 'age')['points']);
    }

    public function test_age_30_to_39_gives_zero_points(): void
    {
        $component30 = $this->comp($this->score(['income_per_capita' => 0.0, 'head_age' => 30]), 'age');
        $this->assertSame(0.0, $component30['points']);
        $this->assertFalse($component30['review_required']);
        $this->assertSame(0.0, $this->comp($this->score(['income_per_capita' => 0.0, 'head_age' => 39]), 'age')['points']);
    }

    public function test_age_under_30_review_required(): void
    {
        $component = $this->comp($this->score(['income_per_capita' => 0.0, 'head_age' => 29]), 'age');
        $this->assertTrue($component['review_required']);
        $this->assertNull($component['points']);
        $this->assertSame(PolicyScoringService::REASON_AGE_REVIEW, $component['reason']);
    }

    public function test_age_derived_from_dob(): void
    {
        $b = $this->makeBeneficiary(['date_of_birth' => '1970-05-05']);
        $inputs = app(PolicyScoringInputProvider::class)->fromBeneficiary($b, ['net_income_per_capita' => 900.0]);

        $this->assertSame(56, $inputs->headAge); // 2026 − 1970
        $this->assertSame(900.0, $inputs->incomePerCapita);
        $this->assertSame('owned', $inputs->housingTenure);
        // No canonical structured fields exist for these → honest null (never invented).
        $this->assertNull($inputs->housingCondition);
        $this->assertNull($inputs->headDisabilityPercent);
        $this->assertNull($inputs->affectedChildrenCount);
    }

    // ── 45–48: TOTALS & MISSING-DATA GUARDS ────────────────────────────────

    public function test_components_total_correctly(): void
    {
        $result = $this->score([
            'income_per_capita' => 400.01,
            'housing_condition' => 'poor',
            'housing_tenure' => 'rented',
            'head_disability_percent' => 100.0,
            'affected_children_count' => 1,
            'head_age' => 60,
        ]);
        $this->assertSame(11.0, $this->comp($result, 'income')['points']);
        $this->assertSame(10.0, $this->comp($result, 'housing_condition')['points']);
        $this->assertSame(10.0, $this->comp($result, 'housing_tenure')['points']);
        $this->assertSame(15.0, $this->comp($result, 'head_health')['points']);
        $this->assertSame(5.0, $this->comp($result, 'children_health')['points']);
        $this->assertSame(15.0, $this->comp($result, 'age')['points']);
        $this->assertSame(66.0, $result['total_score']);
    }

    public function test_documented_maximum_75_reachable_only_through_valid_rules(): void
    {
        $result = $this->score([
            'income_per_capita' => 0.0,
            'housing_condition' => 'poor',
            'housing_tenure' => 'rented',
            'head_disability_percent' => 100.0,
            'affected_children_count' => 3,
            'head_age' => 60,
        ]);
        $this->assertSame(75.0, $result['total_score']);
        $this->assertSame('a', $result['score_category']);
    }

    public function test_configuration_that_can_exceed_max_rejected(): void
    {
        $config = PolicyConfigurationValidator::withDefaults([]);
        $config['scoring']['dimensions']['income']['bands'][0]['points'] = 20; // sum → 80 > 75

        $this->expectException(ValidationException::class);
        PolicyConfigurationValidator::validate($config);
    }

    public function test_missing_data_review_is_not_silently_scored_zero(): void
    {
        $result = $this->score(['income_per_capita' => 0.0]);
        foreach (['housing_condition', 'housing_tenure', 'head_health', 'children_health', 'age'] as $dim) {
            $component = $this->comp($result, $dim);
            $this->assertTrue($component['review_required'], "{$dim} must be review_required");
            $this->assertNull($component['points'], "{$dim} must NOT be silently scored 0");
        }
        // Only income was evaluable → total equals income points, never inflated.
        $this->assertSame(15.0, $result['total_score']);
    }

    // ── 49–59: SCORE CATEGORIES ────────────────────────────────────────────

    private function configWithIncomePoints(int $points): array
    {
        $config = PolicyConfigurationValidator::withDefaults([]);
        $config['scoring']['dimensions']['income']['bands'][0]['points'] = $points;
        foreach (['housing_condition', 'housing_tenure', 'children_health'] as $dim) {
            foreach ($config['scoring']['dimensions'][$dim]['values'] as $i => $row) {
                $config['scoring']['dimensions'][$dim]['values'][$i]['points'] = 0;
            }
        }
        foreach (['head_health', 'age'] as $dim) {
            foreach ($config['scoring']['dimensions'][$dim]['bands'] as $i => $row) {
                $config['scoring']['dimensions'][$dim]['bands'][$i]['points'] = 0;
            }
        }

        return $config;
    }

    private function categoryFor(int $points): string
    {
        $config = $this->configWithIncomePoints($points);

        return $this->scoring->score(
            PolicyScoringInputs::fromStructured(['income_per_capita' => 0.0]),
            $config['scoring'],
            $config['score_categories'],
        )['score_category'];
    }

    public function test_score_75_is_category_a(): void
    {
        $this->assertSame('a', $this->categoryFor(75));
    }

    public function test_score_51_is_category_a(): void
    {
        $this->assertSame('a', $this->categoryFor(51));
    }

    public function test_score_50_is_category_b(): void
    {
        $this->assertSame('b', $this->categoryFor(50));
    }

    public function test_score_26_is_category_b(): void
    {
        $this->assertSame('b', $this->categoryFor(26));
    }

    public function test_score_25_is_category_c(): void
    {
        $this->assertSame('c', $this->categoryFor(25));
    }

    public function test_score_5_is_category_c(): void
    {
        $this->assertSame('c', $this->categoryFor(5));
    }

    public function test_score_4_is_category_d(): void
    {
        $this->assertSame('d', $this->categoryFor(4));
    }

    public function test_score_0_is_category_d(): void
    {
        $this->assertSame('d', $this->categoryFor(0));
    }

    public function test_score_category_overlap_rejected(): void
    {
        $this->expectException(ValidationException::class);
        PolicyConfigurationValidator::validate([
            'score_categories' => ['bands' => [
                ['key' => 'd', 'label' => 'D', 'min' => 0, 'max' => 4],
                ['key' => 'c', 'label' => 'C', 'min' => 5, 'max' => 30],
                ['key' => 'b', 'label' => 'B', 'min' => 25, 'max' => 50], // overlaps c at 25–30
                ['key' => 'a', 'label' => 'A', 'min' => 51, 'max' => 75],
            ]],
        ]);
    }

    public function test_score_category_gap_rejected(): void
    {
        $this->expectException(ValidationException::class);
        PolicyConfigurationValidator::validate([
            'score_categories' => ['bands' => [
                ['key' => 'd', 'label' => 'D', 'min' => 0, 'max' => 4],
                ['key' => 'c', 'label' => 'C', 'min' => 5, 'max' => 25],
                ['key' => 'b', 'label' => 'B', 'min' => 27, 'max' => 50], // 26 uncovered
                ['key' => 'a', 'label' => 'A', 'min' => 51, 'max' => 75],
            ]],
        ]);
    }

    public function test_score_category_above_max_rejected(): void
    {
        $this->expectException(ValidationException::class);
        PolicyConfigurationValidator::validate([
            'score_categories' => ['bands' => [
                ['key' => 'd', 'label' => 'D', 'min' => 0, 'max' => 4],
                ['key' => 'c', 'label' => 'C', 'min' => 5, 'max' => 25],
                ['key' => 'b', 'label' => 'B', 'min' => 26, 'max' => 50],
                ['key' => 'a', 'label' => 'A', 'min' => 51, 'max' => 76], // above max_score 75
            ]],
        ]);
    }

    // ── 60–63: TWO A/B/C/D SYSTEMS STAY SEPARATE ────────────────────────────

    public function test_income_category_independent_of_score_category(): void
    {
        // Per-capita 900 → income category d; score (income 5 + age 5) = 10 → score category c.
        $b = $this->makeBeneficiary(); // 1000 salary, own house, family 1 → per-capita 900
        $evaluation = $this->evaluator->evaluate($b->id, $this->publishVersion()->id, $this->admin->id);

        $this->assertSame('d', $evaluation->income_category);
        $this->assertSame('c', $evaluation->score_category);
        $this->assertNotSame($evaluation->income_category, $evaluation->score_category);
        $this->assertSame(900.0, (float) $evaluation->scoring_snapshot['income']['per_capita']);
        $this->assertSame(10.0, (float) $evaluation->policy_score);
    }

    public function test_degree_classification_remains_independent(): void
    {
        $b = $this->makeBeneficiary();
        $priorityBefore = $b->priority; // legacy classification field (default first_class)

        $evaluation = $this->evaluator->evaluate($b->id, $this->publishVersion()->id, $this->admin->id);
        $this->assertSame('d', $evaluation->income_category);
        $this->assertNull($evaluation->degree_classification_snapshot); // no Degree→A–D mapping
        $this->assertNull($evaluation->need_level_snapshot);
        $this->assertSame($priorityBefore, $b->fresh()->priority); // evaluation never wrote legacy fields
    }

    public function test_resident_need_level_remains_independent(): void
    {
        $b = $this->makeBeneficiary(['beneficiary_type' => 'resident']);
        $evaluation = $this->evaluator->evaluate($b->id, $this->publishVersion()->id, $this->admin->id);

        $this->assertSame('not_applicable', $evaluation->eligibility_decision);
        $this->assertNull($evaluation->income_category);
        $this->assertNull($evaluation->policy_score);
        $this->assertNull($evaluation->score_category);
        $this->assertNull($evaluation->degree_classification_snapshot);
        $this->assertNull($evaluation->need_level_snapshot);
    }

    public function test_no_degree_to_income_mapping(): void
    {
        $b = $this->makeBeneficiary(['monthly_salary' => 1500, 'housing_type' => 'rent', 'annual_rent_amount' => 0]);
        $evaluation = $this->evaluator->evaluate($b->id, $this->publishVersion()->id, $this->admin->id);

        // Per-capita = 1500 − 100 (family 1 deduction) = 1400 → excluded by the 1000 threshold.
        $this->assertSame('excluded', $evaluation->income_category);
        $this->assertNull($evaluation->degree_classification_snapshot);
        // The legacy degree mapping was never applied and no a/b/c/d was invented for it.
        $this->assertNotContains($evaluation->income_category, ['a', 'b', 'c', 'd']);
    }
}
