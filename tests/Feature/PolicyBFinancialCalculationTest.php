<?php

namespace Tests\Feature;

use App\Models\Beneficiary;
use App\Models\BeneficiaryPolicyVersion;
use App\Models\Category;
use App\Models\User;
use App\Services\BeneficiaryPolicy\BeneficiaryPolicyVersionService;
use App\Services\FinancialCalculationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * POLICY-B — authoritative financial contract suite.
 *
 * Covers: default citizen counted sources, per-source enable/disable, amount
 * validation, rent safe modes, authoritative family size, policy-versioned
 * deduction, formula (adjusted net / per-capita / rounding), published-version
 * authority, resident isolation and legacy regression.
 */
class PolicyBFinancialCalculationTest extends TestCase
{
    use RefreshDatabase;

    private FinancialCalculationService $calculator;

    private User $admin;

    private BeneficiaryPolicyVersionService $versions;

    private int $nationalSeq = 0;

    protected function setUp(): void
    {
        parent::setUp();
        $this->calculator = new FinancialCalculationService;
        $this->versions = app(BeneficiaryPolicyVersionService::class);
        $this->admin = User::create([
            'username' => 'TEST_POLICYB', 'full_name' => 'Policy B Admin', 'password' => 'test-password',
            'email' => 'policyb@example.invalid', 'role' => 'admin', 'is_active' => true,
        ]);
        Sanctum::actingAs($this->admin);
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    private function money($value): string
    {
        return sprintf('%.2f', (float) $value);
    }

    private function makeBeneficiary(array $overrides = []): Beneficiary
    {
        $seq = ++$this->nationalSeq;

        return Beneficiary::create(array_merge([
            'beneficiary_type' => 'citizen',
            'full_name' => 'مواطن تجريبي',
            'national_id' => '1'.str_pad((string) $seq, 9, '0', STR_PAD_LEFT), // Saudi ID, male (leading 1)
            'phone' => '05'.str_pad((string) $seq, 8, '0', STR_PAD_LEFT),
            'date_of_birth' => '1980-05-05',
            'city' => 'جدة',
            'district' => 'الفيصلية',
            'street' => 'شارع 1',
            'family_status' => 'poor',
            'family_members_count' => 5,
            'housing_type' => 'rent',
            'annual_rent_amount' => 18000,
            'monthly_rent' => null,
            'income_sources' => ['salary', 'retirement', 'citizen_account', 'social_security', 'family_support'],
            'monthly_salary' => 3000,
            'social_security_amount' => 700,
            'citizen_account_amount' => 500,
            'retirement_pension' => 0,
            'family_support' => 0,
            'status' => 'active',
        ], $overrides));
    }

    private function addDependent(Beneficiary $beneficiary, array $overrides = []): void
    {
        $beneficiary->dependents()->create(array_merge([
            'name' => 'طفل تجريبي',
            'relationship' => 'ابن',
            'date_of_birth' => '2010-01-01',
            'is_active' => true,
        ], $overrides));
    }

    private function makeVersion(array $config = [], array $overrides = []): BeneficiaryPolicyVersion
    {
        return BeneficiaryPolicyVersion::create(array_merge([
            'policy_name' => 'سياسة صرف المساعدات للمستفيدين',
            'policy_scope' => 'citizen_beneficiaries',
            'version' => (string) mt_rand(1000, 9999),
            'effective_from' => '2026-10-01',
            'configuration' => $config,
        ], $overrides));
    }

    private function publishVersion(array $config = [], array $overrides = []): BeneficiaryPolicyVersion
    {
        $version = $this->makeVersion($config, $overrides);
        $this->versions->approve($version->id, ['board_approval_reference' => 'قرار 1/2026', 'board_approval_date' => '2026-09-20'], $this->admin->id);
        $this->versions->publish($version->id, $this->admin->id);

        return $version->fresh();
    }

    private function retireVersion(BeneficiaryPolicyVersion $version): void
    {
        $this->versions->retire($version->id, ['change_reason' => 'استبدال السياسة'], $this->admin->id);
    }

    private function financials(Beneficiary $beneficiary, BeneficiaryPolicyVersion $version): array
    {
        return $this->calculator->calculatePolicyFinancials($beneficiary, $version);
    }

    // ── FINANCIAL CONTRACT (1–11) ──────────────────────────────────────────

    public function test_default_citizen_counted_sources(): void
    {
        $b = $this->makeBeneficiary(['housing_type' => 'own', 'retirement_pension' => 2000]);
        $res = $this->financials($b, $this->publishVersion());

        $this->assertSame('4200.00', $this->money($res['counted_gross_monthly_income']));
        $this->assertSame(['salary', 'social_security', 'citizen_account'], $res['income_sources']['counted']);
    }

    public function test_salary_only(): void
    {
        $b = $this->makeBeneficiary(['housing_type' => 'own']);
        $res = $this->financials($b, $this->publishVersion(['financial' => ['counted_income_sources' => ['salary']]]));

        $this->assertSame('3000.00', $this->money($res['counted_gross_monthly_income']));
    }

    public function test_salary_plus_social_security(): void
    {
        $b = $this->makeBeneficiary(['housing_type' => 'own']);
        $res = $this->financials($b, $this->publishVersion(['financial' => ['counted_income_sources' => ['salary', 'social_security']]]));

        $this->assertSame('3700.00', $this->money($res['counted_gross_monthly_income']));
    }

    public function test_salary_plus_citizen_account(): void
    {
        $b = $this->makeBeneficiary(['housing_type' => 'own']);
        $res = $this->financials($b, $this->publishVersion(['financial' => ['counted_income_sources' => ['salary', 'citizen_account']]]));

        $this->assertSame('3500.00', $this->money($res['counted_gross_monthly_income']));
    }

    public function test_salary_plus_social_security_plus_citizen_account(): void
    {
        $b = $this->makeBeneficiary(['housing_type' => 'own']);
        $res = $this->financials($b, $this->publishVersion());

        $this->assertSame('4200.00', $this->money($res['counted_gross_monthly_income']));
    }

    public function test_retirement_present_but_disabled_is_not_counted(): void
    {
        $b = $this->makeBeneficiary(['housing_type' => 'own', 'retirement_pension' => 2000]);
        $res = $this->financials($b, $this->publishVersion());

        $this->assertSame('4200.00', $this->money($res['counted_gross_monthly_income']));
        $this->assertContains('retirement', $res['income_sources']['available']);
        $this->assertContains('retirement', $res['income_sources']['not_counted']);
        $this->assertNotContains('retirement', $res['income_sources']['counted']);
        $this->assertSame(2000.0, $res['income_sources']['amounts']['retirement']);
    }

    public function test_retirement_enabled_by_policy_is_counted(): void
    {
        $b = $this->makeBeneficiary(['housing_type' => 'own', 'retirement_pension' => 2000]);
        $res = $this->financials($b, $this->publishVersion(['financial' => ['counted_income_sources' => ['salary', 'social_security', 'citizen_account', 'retirement']]]));

        $this->assertSame('6200.00', $this->money($res['counted_gross_monthly_income']));
        $this->assertContains('retirement', $res['income_sources']['counted']);
    }

    public function test_family_support_present_but_disabled_is_not_counted(): void
    {
        $b = $this->makeBeneficiary(['housing_type' => 'own', 'family_support' => 400]);
        $res = $this->financials($b, $this->publishVersion());

        $this->assertSame('4200.00', $this->money($res['counted_gross_monthly_income']));
        $this->assertContains('family_support', $res['income_sources']['not_counted']);
        $this->assertSame(400.0, $res['income_sources']['amounts']['family_support']);
    }

    public function test_other_source_enabled_is_counted(): void
    {
        $b = $this->makeBeneficiary(['housing_type' => 'own', 'other_income_amount' => 300]);
        $res = $this->financials($b, $this->publishVersion(['financial' => ['counted_income_sources' => ['salary', 'other']]]));

        $this->assertSame('3300.00', $this->money($res['counted_gross_monthly_income']));
        $this->assertContains('other', $res['income_sources']['counted']);
    }

    public function test_negative_source_rejected(): void
    {
        $b = $this->makeBeneficiary(['housing_type' => 'own', 'monthly_salary' => -500]);
        $this->expectException(ValidationException::class);
        $this->financials($b, $this->publishVersion());
    }

    public function test_invalid_numeric_source_rejected_at_storage_boundary(): void
    {
        // The authoritative calculator reads RAW (uncast) values so junk input can
        // never reach arithmetic silently: a non-numeric amount must be rejected
        // with a clean ValidationException instead of a decimal-cast math error.
        $b = $this->makeBeneficiary(['housing_type' => 'own', 'monthly_salary' => 'not-a-number']);
        $version = $this->publishVersion();

        try {
            $this->financials($b, $version);
            $this->fail('Non-numeric income must be rejected, never silently converted.');
        } catch (ValidationException) {
            $this->addToAssertionCount(1);
        }
    }

    // ── RENT (12–16) ───────────────────────────────────────────────────────

    public function test_annual_rent_divided_by_12(): void
    {
        $b = $this->makeBeneficiary(['housing_type' => 'rent', 'annual_rent_amount' => 18000, 'monthly_rent' => null]);
        $res = $this->financials($b, $this->publishVersion());

        $this->assertSame('1500.00', $this->money($res['monthly_rent']));
        $this->assertSame('annual_preference', $res['rent_mode']);
    }

    public function test_direct_monthly_rent(): void
    {
        $b = $this->makeBeneficiary(['housing_type' => 'rent', 'annual_rent_amount' => 0, 'monthly_rent' => 900]);
        $res = $this->financials($b, $this->publishVersion());

        $this->assertSame('900.00', $this->money($res['monthly_rent']));
    }

    public function test_zero_rent_is_allowed(): void
    {
        $version = $this->publishVersion();

        $own = $this->makeBeneficiary(['housing_type' => 'own', 'annual_rent_amount' => 0]);
        $this->assertSame('0.00', $this->money($this->financials($own, $version)['monthly_rent']));

        $rentZero = $this->makeBeneficiary(['housing_type' => 'rent', 'annual_rent_amount' => 0, 'monthly_rent' => null]);
        $this->assertSame('0.00', $this->money($this->financials($rentZero, $version)['monthly_rent']));
    }

    public function test_annual_and_monthly_coexist_without_double_deduction(): void
    {
        $b = $this->makeBeneficiary([
            'housing_type' => 'rent', 'annual_rent_amount' => 18000, 'monthly_rent' => 900,
            'monthly_rent_direct_input' => 900,
        ]);

        // annual_preference (default): only annual/12 is used — never both.
        $vAnnual = $this->publishVersion();
        $res = $this->financials($b, $vAnnual);
        $this->assertSame('1500.00', $this->money($res['monthly_rent']));

        // One-active-policy rule: retire before publishing the second mode.
        $this->retireVersion($vAnnual);
        $resDirect = $this->financials($b, $this->publishVersion(['financial' => ['rent_mode' => 'direct_monthly_preference']]));
        $this->assertSame('900.00', $this->money($resDirect['monthly_rent']));
        $this->assertSame('direct_monthly_preference', $resDirect['rent_mode']);
    }

    public function test_invalid_negative_rent_rejected(): void
    {
        $version = $this->publishVersion();

        $threwAnnual = false;
        try {
            $this->financials($this->makeBeneficiary(['housing_type' => 'rent', 'annual_rent_amount' => -100]), $version);
        } catch (ValidationException) {
            $threwAnnual = true;
        }
        $this->assertTrue($threwAnnual, 'Negative annual rent must be rejected.');

        $threwDirect = false;
        try {
            // Negative direct monthly rent reaches the calculator through the raw
            // input column (the legacy monthly_rent preview would clamp it to 0).
            $this->financials($this->makeBeneficiary([
                'housing_type' => 'rent', 'annual_rent_amount' => 0,
                'monthly_rent' => -5, 'monthly_rent_direct_input' => -5,
            ]), $version);
        } catch (ValidationException) {
            $threwDirect = true;
        }
        $this->assertTrue($threwDirect, 'Negative direct monthly rent must be rejected.');
    }

    // ── FAMILY (17–22) ─────────────────────────────────────────────────────

    public function test_head_only_family_size_is_one(): void
    {
        $b = $this->makeBeneficiary(['housing_type' => 'own']);
        $res = $this->financials($b, $this->publishVersion());

        $this->assertSame(1, $res['family_size']);
        $this->assertSame(0, $res['dependents_count']);
    }

    public function test_head_plus_active_dependents(): void
    {
        $b = $this->makeBeneficiary(['housing_type' => 'own']);
        $this->addDependent($b);
        $this->addDependent($b);

        $res = $this->financials($b, $this->publishVersion());
        $this->assertSame(3, $res['family_size']);
        $this->assertSame(2, $res['dependents_count']);
    }

    public function test_inactive_dependent_excluded(): void
    {
        $b = $this->makeBeneficiary(['housing_type' => 'own']);
        $this->addDependent($b);
        $this->addDependent($b, ['is_active' => false]);

        $res = $this->financials($b, $this->publishVersion());
        $this->assertSame(2, $res['family_size']);
        $this->assertSame(1, $res['dependents_count']);
    }

    public function test_client_fake_family_count_cannot_override_authoritative_count(): void
    {
        $b = $this->makeBeneficiary(['housing_type' => 'own', 'family_members_count' => 12]);
        $this->addDependent($b);

        $res = $this->financials($b, $this->publishVersion());
        $this->assertSame(2, $res['family_size']);
        $this->assertSame(12, $res['family_members_count_cached']);
    }

    public function test_family_deduction_uses_policy_version_value(): void
    {
        $b = $this->makeBeneficiary(['housing_type' => 'own']);
        $this->addDependent($b);
        $this->addDependent($b);

        $v1 = $this->publishVersion(['financial' => ['per_family_member_deduction' => 100]]);
        $res100 = $this->financials($b, $v1);
        $this->assertSame('300.00', $this->money($res100['family_member_deduction']));

        // One-active-policy rule: retire v1 before publishing a second version.
        $this->retireVersion($v1);
        $res150 = $this->financials($b, $this->publishVersion(['financial' => ['per_family_member_deduction' => 150]]));
        $this->assertSame('450.00', $this->money($res150['family_member_deduction']));
    }

    public function test_changing_draft_deduction_does_not_alter_old_published_evaluation(): void
    {
        $b = $this->makeBeneficiary(['housing_type' => 'own']);
        $this->addDependent($b);
        $this->addDependent($b);

        $v1 = $this->publishVersion(['financial' => ['per_family_member_deduction' => 100]]);
        $before = $this->financials($b, $v1);

        // Version 2 (new deduction) — retire v1 first (one-active-policy rule).
        $this->retireVersion($v1);
        $v2 = $this->publishVersion(['financial' => ['per_family_member_deduction' => 150]]);

        $afterV2 = $this->financials($b, $v2);
        $afterV1 = $this->financials($b, $v1);

        $this->assertSame('300.00', $this->money($before['family_member_deduction']));
        $this->assertSame('450.00', $this->money($afterV2['family_member_deduction']));
        $this->assertSame($before['family_member_deduction'], $afterV1['family_member_deduction']);
        $this->assertSame($before['adjusted_net_household_income'], $afterV1['adjusted_net_household_income']);
    }

    // ── FORMULA (23–28) ────────────────────────────────────────────────────

    public function test_normal_adjusted_net_calculation(): void
    {
        // Spec example: counted 4200 − rent 1500 − deduction 500 → 2200.
        $b = $this->makeBeneficiary([
            'housing_type' => 'rent', 'annual_rent_amount' => 18000,
            'family_members_count' => 5,
        ]);
        $this->addDependent($b);
        $this->addDependent($b);
        $this->addDependent($b);
        $this->addDependent($b);

        $res = $this->financials($b, $this->publishVersion());
        $this->assertSame('4200.00', $this->money($res['counted_gross_monthly_income']));
        $this->assertSame('1500.00', $this->money($res['monthly_rent']));
        $this->assertSame('500.00', $this->money($res['family_member_deduction']));
        $this->assertSame('2200.00', $this->money($res['adjusted_net_household_income']));
        $this->assertSame(5, $res['family_size']);
    }

    public function test_deduction_exceeds_income_clamps_to_zero(): void
    {
        $b = $this->makeBeneficiary([
            'housing_type' => 'rent', 'annual_rent_amount' => 6000,
            'monthly_salary' => 300, 'social_security_amount' => 0, 'citizen_account_amount' => 0,
        ]);

        $res = $this->financials($b, $this->publishVersion());
        $this->assertSame('0.00', $this->money($res['adjusted_net_household_income']));
    }

    public function test_per_capita_calculation(): void
    {
        // Spec household: counted 4200 − rent 1500 (annual 18000/12) − deduction 500 = 2200 → 440.00 / 5.
        $b = $this->makeBeneficiary(['housing_type' => 'rent', 'annual_rent_amount' => 18000]);
        $this->addDependent($b);
        $this->addDependent($b);
        $this->addDependent($b);
        $this->addDependent($b);

        $res = $this->financials($b, $this->publishVersion());
        $this->assertSame(5, $res['family_size']);
        $this->assertSame('440.00', $this->money($res['net_income_per_capita'])); // 2200 / 5
    }

    public function test_deterministic_rounding(): void
    {
        // counted = 400 (salary only, other defaults zeroed), family = 3 →
        // adjusted = 400 − 0 − 300 = 100 → per-capita = 100/3 = 33.33 (2 dp).
        $b = $this->makeBeneficiary([
            'housing_type' => 'own',
            'monthly_salary' => 400, 'social_security_amount' => 0, 'citizen_account_amount' => 0,
        ]);
        $this->addDependent($b);
        $this->addDependent($b);

        $version = $this->publishVersion(['financial' => ['counted_income_sources' => ['salary']]]);
        $first = $this->financials($b, $version);
        $second = $this->financials($b, $version);

        $this->assertSame('33.33', $this->money($first['net_income_per_capita']));
        $this->assertSame('100.00', $this->money($first['adjusted_net_household_income']));
        $this->assertSame('33.33', $this->money($second['net_income_per_capita'])); // repeatable/deterministic
        $this->assertSame(2, $first['precision']['decimal_places']);
    }

    public function test_zero_income(): void
    {
        $b = $this->makeBeneficiary([
            'housing_type' => 'own',
            'monthly_salary' => 0, 'social_security_amount' => 0, 'citizen_account_amount' => 0,
            'annual_rent_amount' => 0,
        ]);

        $res = $this->financials($b, $this->publishVersion());
        $this->assertSame('0.00', $this->money($res['counted_gross_monthly_income']));
        $this->assertSame('0.00', $this->money($res['adjusted_net_household_income']));
        $this->assertSame('0.00', $this->money($res['net_income_per_capita']));
    }

    public function test_high_value_decimal_precision(): void
    {
        $b = $this->makeBeneficiary([
            'housing_type' => 'own', 'monthly_salary' => 1234567.89,
            'social_security_amount' => 0, 'citizen_account_amount' => 0,
        ]);

        $res = $this->financials($b, $this->publishVersion());
        $this->assertSame('1234567.89', $this->money($res['counted_gross_monthly_income']));
        $this->assertSame('1234467.89', $this->money($res['adjusted_net_household_income'])); // minus 1 × 100
        $this->assertSame('1234467.89', $this->money($res['net_income_per_capita']));
    }

    // ── POLICY VERSION (29) ────────────────────────────────────────────────

    public function test_published_version_required_for_calculation(): void
    {
        $b = $this->makeBeneficiary(['housing_type' => 'own']);
        $draft = $this->makeVersion();

        $this->expectException(ValidationException::class);
        $this->financials($b, $draft);
    }

    // ── RESIDENT ISOLATION (33–36) ─────────────────────────────────────────

    public function test_resident_current_calculation_unchanged(): void
    {
        $resident = $this->makeBeneficiary([
            'beneficiary_type' => 'resident',
            'nationality' => 'مصرية',
            'income_sources' => ['salary', 'family_support'],
            'monthly_salary' => 2000, 'family_support' => 300,
            'housing_type' => 'own',
        ]);

        $res = $this->calculator->calculate($resident->getAttributes());

        $this->assertSame('2300.00', $this->money($res['total_income'])); // salary + family_support only
        $this->assertSame('second_class', $res['priority']);
    }

    public function test_citizen_policy_calculation_for_resident_is_rejected(): void
    {
        $resident = $this->makeBeneficiary([
            'beneficiary_type' => 'resident',
            'nationality' => 'مصرية',
            'housing_type' => 'own',
        ]);

        $this->expectException(ValidationException::class);
        $this->financials($resident, $this->publishVersion());
    }

    public function test_resident_degree_remains_second_degree(): void
    {
        $resident = $this->makeBeneficiary([
            'beneficiary_type' => 'resident', 'nationality' => 'مصرية', 'housing_type' => 'own',
        ]);

        $this->assertSame('second_class', $this->calculator->determinePriority($resident->getAttributes(), 0, false));

        $res = $this->calculator->calculate($resident->getAttributes());
        $category = Category::find($res['category_id']);
        $this->assertStringContainsString('درجة ثانية', (string) $category?->name);
    }

    public function test_resident_need_level_unchanged(): void
    {
        $residentLow = $this->makeBeneficiary([
            'beneficiary_type' => 'resident', 'nationality' => 'مصرية',
            'monthly_salary' => 500, 'housing_type' => 'own',
        ]);
        $residentHigh = $this->makeBeneficiary([
            'beneficiary_type' => 'resident', 'nationality' => 'مصرية',
            'monthly_salary' => 9000, 'housing_type' => 'own',
        ]);

        $this->assertSame('severe_need', $this->calculator->calculate($residentLow->getAttributes())['need_level']);
        $this->assertSame('normal_need', $this->calculator->calculate($residentHigh->getAttributes())['need_level']);

        // Model accessor path still works for residents.
        $this->assertSame('severe_need', $residentLow->need_level);
    }

    // ── REGRESSION (51–52) ─────────────────────────────────────────────────

    public function test_legacy_citizen_calculation_behavior_not_unintentionally_broken(): void
    {
        $data = [
            'beneficiary_type' => 'citizen',
            'income_sources' => ['salary', 'retirement', 'citizen_account', 'social_security', 'family_support'],
            'monthly_salary' => 2500, 'retirement_pension' => 1000,
            'citizen_account_amount' => 500, 'social_security_amount' => 1200, 'family_support' => 300,
            'housing_type' => 'own',
        ];

        $res = $this->calculator->calculate($data);

        $this->assertSame('5500.00', $this->money($res['total_income']));
        $this->assertSame($res['total_income'], $res['gross_income']);
        $this->assertNull($res['need_level']);
    }

    public function test_resident_regression(): void
    {
        $resident = $this->makeBeneficiary([
            'beneficiary_type' => 'resident', 'nationality' => 'مصرية',
            'monthly_salary' => 2500, 'family_support' => 200,
            'housing_type' => 'rent', 'annual_rent_amount' => 6000,
        ]);

        $res = $this->calculator->calculate($resident->getAttributes());

        $this->assertSame('2700.00', $this->money($res['total_income']));
        $this->assertSame('500.00', $this->money($res['monthly_rent'])); // 6000/12
        $this->assertSame('2200.00', $this->money($res['net_income']));
        $this->assertSame('second_class', $res['priority']);
    }
}
