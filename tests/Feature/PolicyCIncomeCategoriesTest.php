<?php

namespace Tests\Feature;

use App\Models\Beneficiary;
use App\Models\BeneficiaryPolicyVersion;
use App\Models\User;
use App\Services\BeneficiaryPolicy\BeneficiaryPolicyVersionService;
use App\Services\BeneficiaryPolicy\PolicyConfigurationValidator;
use App\Services\BeneficiaryPolicy\PolicyFinancialEvaluationService;
use App\Services\BeneficiaryPolicy\PolicyIncomeCategoriesService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * POLICY-C — income categories (authorization mandate tests 1–13).
 *
 * Deterministic integer-cents boundary comparisons: 400.00 → A, 400.01 → B.
 */
class PolicyCIncomeCategoriesTest extends TestCase
{
    use RefreshDatabase;

    protected BeneficiaryPolicyVersionService $versions;

    protected PolicyFinancialEvaluationService $evaluator;

    protected PolicyIncomeCategoriesService $categories;

    protected int $nationalSeq = 0;

    protected User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->versions = app(BeneficiaryPolicyVersionService::class);
        $this->evaluator = app(PolicyFinancialEvaluationService::class);
        $this->categories = app(PolicyIncomeCategoriesService::class);
        $this->admin = User::create([
            'username' => 'TEST_POLICYC_INCOME', 'full_name' => 'Policy C Income Admin',
            'password' => 'test-password', 'email' => 'policyc-income@example.invalid',
            'role' => 'admin', 'is_active' => true,
        ]);
        Sanctum::actingAs($this->admin);
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    protected function defaults(): array
    {
        return PolicyConfigurationValidator::withDefaults([]);
    }

    protected function classifiable(float $perCapita): array
    {
        return $this->categories->classify($perCapita, $this->defaults()['income_categories']);
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

    // ── 1–9: DEFAULT BOUNDARIES ────────────────────────────────────────────

    public function test_zero_per_capita_is_category_a(): void
    {
        $this->assertSame('a', $this->classifiable(0.0)['category']);
        $this->assertSame(PolicyIncomeCategoriesService::STATUS_ELIGIBLE, $this->classifiable(0.0)['status']);
    }

    public function test_400_boundary_is_category_a(): void
    {
        $this->assertSame('a', $this->classifiable(400.0)['category']);
    }

    public function test_decimal_immediately_above_400_is_category_b(): void
    {
        $this->assertSame('b', $this->classifiable(400.01)['category']);
    }

    public function test_600_boundary_is_category_b(): void
    {
        $this->assertSame('b', $this->classifiable(600.0)['category']);
    }

    public function test_above_600_is_category_c(): void
    {
        $this->assertSame('c', $this->classifiable(600.01)['category']);
    }

    public function test_800_boundary_is_category_c(): void
    {
        $this->assertSame('c', $this->classifiable(800.0)['category']);
    }

    public function test_above_800_is_category_d(): void
    {
        $this->assertSame('d', $this->classifiable(800.01)['category']);
    }

    public function test_1000_boundary_is_category_d(): void
    {
        $this->assertSame('d', $this->classifiable(1000.0)['category']);
    }

    public function test_above_1000_is_excluded(): void
    {
        $result = $this->classifiable(1000.01);
        $this->assertSame(PolicyIncomeCategoriesService::CATEGORY_EXCLUDED, $result['category']);
        $this->assertSame(PolicyIncomeCategoriesService::STATUS_EXCLUDED, $result['status']);
        $this->assertNull($result['band']);
    }

    // ── 10: CONFIGURABLE BANDS ON A PUBLISHED VERSION ───────────────────────

    public function test_bands_configurable_by_published_policy(): void
    {
        // Default threshold 1000 → 900 sits in category d.
        $vDefault = $this->publishVersion();
        $b = $this->makeBeneficiary(); // 1000 salary, own house, family 1 → per-capita 900
        $this->assertSame('d', $this->evaluator->evaluate($b->id, $vDefault->id, $this->admin->id)->income_category);
        $this->versions->retire($vDefault->id, ['change_reason' => 'استبدال'], $this->admin->id);

        // Custom threshold 800 → 900 is excluded even though the default keeps it inside.
        $vCustom = $this->publishVersion([
            'income_categories' => [
                'exclusion_threshold' => 800,
                'bands' => [['key' => 'a', 'label' => 'A', 'min' => 0, 'max' => 400], ['key' => 'b', 'label' => 'B', 'min' => 400.01, 'max' => 800]],
            ],
        ]);
        $this->assertSame('excluded', $this->evaluator->evaluate($b->id, $vCustom->id, $this->admin->id)->income_category);
        $this->versions->retire($vCustom->id, ['change_reason' => 'استبدال'], $this->admin->id);

        // Wider default-shaped bands → 900 falls in b.
        $vWide = $this->publishVersion([
            'income_categories' => [
                'exclusion_threshold' => 1000,
                'bands' => [
                    ['key' => 'a', 'label' => 'A', 'min' => 0, 'max' => 500],
                    ['key' => 'b', 'label' => 'B', 'min' => 500.01, 'max' => 1000],
                ],
            ],
        ]);
        $this->assertSame('b', $this->evaluator->evaluate($b->id, $vWide->id, $this->admin->id)->income_category);
    }

    // ── 11–13: CONFIGURATION VALIDATION ─────────────────────────────────────

    public function test_overlapping_bands_rejected(): void
    {
        $this->expectException(ValidationException::class);
        PolicyConfigurationValidator::validate([
            'income_categories' => [
                'exclusion_threshold' => 600,
                'bands' => [
                    ['key' => 'a', 'label' => 'A', 'min' => 0, 'max' => 400],
                    ['key' => 'b', 'label' => 'B', 'min' => 400, 'max' => 600], // overlaps at 400
                ],
            ],
        ]);
    }

    public function test_reversed_band_rejected(): void
    {
        $this->expectException(ValidationException::class);
        PolicyConfigurationValidator::validate([
            'income_categories' => [
                'exclusion_threshold' => 600,
                'bands' => [
                    ['key' => 'a', 'label' => 'A', 'min' => 0, 'max' => 400],
                    ['key' => 'b', 'label' => 'B', 'min' => 500, 'max' => 400], // reversed
                ],
            ],
        ]);
    }

    public function test_gap_in_bands_rejected(): void
    {
        $this->expectException(ValidationException::class);
        PolicyConfigurationValidator::validate([
            'income_categories' => [
                'exclusion_threshold' => 800,
                'bands' => [
                    ['key' => 'a', 'label' => 'A', 'min' => 0, 'max' => 400],
                    ['key' => 'b', 'label' => 'B', 'min' => 500, 'max' => 800], // 400.01–499.99 uncovered
                ],
            ],
        ]);
    }

    public function test_invalid_overlap_rejected_visibly_via_api(): void
    {
        $id = $this->postJson('/api/beneficiary-policy/versions', [
            'policy_name' => 'سياسة صرف المساعدات للمستفيدين',
            'version' => 'X1', 'policy_scope' => 'citizen_beneficiaries',
            'effective_from' => '2027-01-01',
            'configuration' => ['financial' => ['counted_income_sources' => ['salary']]],
        ])->assertCreated()->json('data.id');

        $this->patchJson('/api/beneficiary-policy/versions/'.$id, [
            'configuration' => ['income_categories' => [
                'exclusion_threshold' => 600,
                'bands' => [
                    ['key' => 'a', 'label' => 'A', 'min' => 0, 'max' => 400],
                    ['key' => 'b', 'label' => 'B', 'min' => 400, 'max' => 600],
                ],
            ]],
        ])->assertStatus(422)->assertJsonValidationErrors('configuration.income_categories.bands');
    }
}
