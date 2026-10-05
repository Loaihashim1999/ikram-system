<?php

namespace Tests\Feature;

use App\Models\Beneficiary;
use App\Models\BeneficiaryPolicyEvaluation;
use App\Models\BeneficiaryPolicyVersion;
use App\Models\InventoryItem;
use App\Models\Organization;
use App\Models\PickupLocation;
use App\Models\User;
use App\Services\BeneficiaryPolicy\BeneficiaryPolicyEligibilityService;
use App\Services\BeneficiaryPolicy\BeneficiaryPolicyVersionService;
use App\Services\BeneficiaryPolicy\PolicyFinancialEvaluationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\TestCase;

/**
 * POLICY-B — evaluation orchestration, eligibility, snapshot integrity,
 * authorization and phase regressions.
 */
class PolicyBEvaluationAndEligibilityTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;

    protected BeneficiaryPolicyVersionService $versions;

    protected PolicyFinancialEvaluationService $evaluator;

    protected int $nationalSeq = 0;

    protected function setUp(): void
    {
        parent::setUp();
        $this->versions = app(BeneficiaryPolicyVersionService::class);
        $this->evaluator = app(PolicyFinancialEvaluationService::class);
        $this->admin = User::create([
            'username' => 'TEST_POLICYBEVAL', 'full_name' => 'Policy B Evaluation Admin',
            'password' => 'test-password', 'email' => 'policyb-eval@example.invalid',
            'role' => 'admin', 'is_active' => true,
        ]);
        Sanctum::actingAs($this->admin);
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    protected function money($value): string
    {
        return sprintf('%.2f', (float) $value);
    }

    protected function makeBeneficiary(array $overrides = []): Beneficiary
    {
        $seq = ++$this->nationalSeq;

        return Beneficiary::create(array_merge([
            'beneficiary_type' => 'citizen',
            'full_name' => 'مواطن تجريبي',
            'national_id' => '1'.str_pad((string) $seq, 9, '0', STR_PAD_LEFT), // Saudi ID, male (leading 1)
            'phone' => '05'.str_pad((string) $seq, 8, '0', STR_PAD_LEFT),
            'iban_encrypted' => 'TEST-IBAN-NOT-TO-LEAK',
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
            'retirement_pension' => 2000,
            'family_support' => 0,
            'status' => 'active',
        ], $overrides));
    }

    protected function addDependent(Beneficiary $beneficiary, array $overrides = []): void
    {
        $beneficiary->dependents()->create(array_merge([
            'name' => 'طفل تجريبي',
            'relationship' => 'ابن',
            'date_of_birth' => '2010-01-01',
            'is_active' => true,
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

    protected function retireVersion(BeneficiaryPolicyVersion $version): void
    {
        $this->versions->retire($version->id, ['change_reason' => 'استبدال السياسة'], $this->admin->id);
    }

    protected function evaluate(Beneficiary $beneficiary, BeneficiaryPolicyVersion $version): BeneficiaryPolicyEvaluation
    {
        return $this->evaluator->evaluate($beneficiary->id, $version->id, $this->admin->id);
    }

    /** Spec example household: counted 4200, rent 1500, family 5, deduction 500 → 2200, per-capita 440. */
    protected function specBeneficiary(): Beneficiary
    {
        $b = $this->makeBeneficiary(['housing_type' => 'rent', 'annual_rent_amount' => 18000]);
        foreach (range(1, 4) as $i) {
            $this->addDependent($b);
        }

        return $b;
    }

    protected function permissionUser(array $perms, string $role = 'assistant_admin'): User
    {
        $user = User::create([
            'username' => 'TEST_POLICY_B_'.strtoupper(substr(md5(uniqid('', true)), 0, 8)),
            'full_name' => 'Policy B User', 'password' => 'test-password',
            'email' => 'policyb-user-'.substr(md5(uniqid('', true)), 0, 12).'@example.invalid', 'role' => $role,
            'permissions' => ['beneficiary_policy' => $perms], 'is_active' => true,
        ]);
        Sanctum::actingAs($user);

        return $user;
    }

    // ── POLICY VERSION AUTHORITY (30–32) ───────────────────────────────────

    public function test_draft_policy_cannot_produce_persisted_evaluation(): void
    {
        $b = $this->makeBeneficiary(['housing_type' => 'own']);
        $draft = $this->makeVersion();

        try {
            $this->evaluate($b, $draft);
            $this->fail('A draft policy must never produce a persisted evaluation.');
        } catch (HttpException $e) {
            $this->assertSame(409, $e->getStatusCode());
        }

        $this->assertDatabaseCount('beneficiary_policy_evaluations', 0);
    }

    public function test_retired_historical_policy_evaluations_remain_readable(): void
    {
        $b = $this->makeBeneficiary(['housing_type' => 'own']);
        $v1 = $this->publishVersion();
        $evaluation = $this->evaluate($b, $v1);

        $this->retireVersion($v1);
        $this->assertTrue($v1->fresh()->isRetired());

        $stored = BeneficiaryPolicyEvaluation::findOrFail($evaluation->id);
        $this->assertSame($v1->id, $stored->policy_version_id);
        $this->assertSame('review_required', $stored->eligibility_decision); // default review gates
        $this->assertSame($evaluation->financial_snapshot, $stored->financial_snapshot);
    }

    public function test_new_policy_version_does_not_mutate_old_evaluation(): void
    {
        $b = $this->makeBeneficiary(['housing_type' => 'own']);
        $this->addDependent($b);
        $this->addDependent($b);

        $v1 = $this->publishVersion(['financial' => ['per_family_member_deduction' => 100]]);
        $old = $this->evaluate($b, $v1);
        $oldSnapshot = $old->financial_snapshot;

        $this->retireVersion($v1);
        $v2 = $this->publishVersion(['financial' => ['per_family_member_deduction' => 300]]);
        $fresh = $this->evaluate($b, $v2);

        $this->assertSame('300.00', $this->money($oldSnapshot['family_member_deduction']));
        $this->assertSame('900.00', $this->money($fresh->financial_snapshot['family_member_deduction']));

        $storedOld = BeneficiaryPolicyEvaluation::findOrFail($old->id);
        $this->assertSame($oldSnapshot, $storedOld->financial_snapshot);
        $this->assertSame($v1->id, $storedOld->policy_version_id);
    }

    // ── ELIGIBILITY (37–42) ────────────────────────────────────────────────

    public function test_clearly_eligible_structured_case(): void
    {
        $b = $this->makeBeneficiary(['housing_type' => 'own', 'family_status' => 'poor']);
        $version = $this->publishVersion(['eligibility' => ['review' => [
            'documents' => false, 'service_area' => false, 'landlord_relation' => false,
            'family_status' => false, 'male_under_40' => false,
        ]]]);

        $evaluation = $this->evaluate($b, $version);

        $this->assertSame('eligible', $evaluation->eligibility_decision);
        $this->assertSame([], $evaluation->eligibility_reasons);
    }

    public function test_ineligible_when_beneficiary_suspended(): void
    {
        $b = $this->makeBeneficiary(['housing_type' => 'own', 'status' => 'suspended']);
        $version = $this->publishVersion(['eligibility' => ['review' => [
            'documents' => false, 'service_area' => false, 'landlord_relation' => false,
            'family_status' => false, 'male_under_40' => false,
        ]]]);

        $evaluation = $this->evaluate($b, $version);

        $this->assertSame('ineligible', $evaluation->eligibility_decision);
        $this->assertSame([BeneficiaryPolicyEligibilityService::REASON_INELIGIBLE_STATUS], $evaluation->eligibility_reasons);
    }

    public function test_document_review_flag_yields_review_required(): void
    {
        // Default policy configuration: all review gates enabled.
        $b = $this->makeBeneficiary(['housing_type' => 'own', 'family_status' => 'poor', 'date_of_birth' => '1980-05-05']);
        $evaluation = $this->evaluate($b, $this->publishVersion());

        $this->assertSame('review_required', $evaluation->eligibility_decision);
        $this->assertContains(BeneficiaryPolicyEligibilityService::REASON_POLICY_DOCUMENT_REVIEW_REQUIRED, $evaluation->eligibility_reasons);
    }

    public function test_male_under_40_medical_review_flag(): void
    {
        // Saudi male ID (1…) born after 1986 → age under 40.
        $b = $this->makeBeneficiary(['housing_type' => 'own', 'date_of_birth' => '1995-03-03']);
        $enabled = $this->publishVersion(['eligibility' => ['review' => [
            'documents' => false, 'service_area' => false, 'landlord_relation' => false,
            'family_status' => false, 'male_under_40' => true,
        ]]]);

        $evaluation = $this->evaluate($b, $enabled);
        $this->assertSame('review_required', $evaluation->eligibility_decision);
        $this->assertContains(BeneficiaryPolicyEligibilityService::REASON_MALE_UNDER_40_MEDICAL_REVIEW_REQUIRED, $evaluation->eligibility_reasons);

        // The gate is configurable: disabled → rule not flagged. One-active rule:
        // retire the first version before publishing the second.
        $this->retireVersion($enabled);
        $disabled = $this->publishVersion(['eligibility' => ['review' => [
            'documents' => false, 'service_area' => false, 'landlord_relation' => false,
            'family_status' => false, 'male_under_40' => false,
        ]]]);
        $evalDisabled = $this->evaluate($b, $disabled);
        $this->assertSame('eligible', $evalDisabled->eligibility_decision);
    }

    public function test_service_area_review_flag(): void
    {
        $b = $this->makeBeneficiary(['housing_type' => 'own']);
        $version = $this->publishVersion(['eligibility' => ['review' => [
            'documents' => false, 'service_area' => true, 'landlord_relation' => false,
            'family_status' => false, 'male_under_40' => false,
        ]]]);

        $evaluation = $this->evaluate($b, $version);

        $this->assertSame('review_required', $evaluation->eligibility_decision);
        $this->assertSame([BeneficiaryPolicyEligibilityService::REASON_SERVICE_AREA_REVIEW_REQUIRED], $evaluation->eligibility_reasons);
    }

    public function test_reason_codes_are_stable_machine_readable(): void
    {
        $codes = [
            BeneficiaryPolicyEligibilityService::REASON_POLICY_NOT_APPLICABLE_RESIDENT => 'POLICY_NOT_APPLICABLE_RESIDENT',
            BeneficiaryPolicyEligibilityService::REASON_REQUIRES_CITIZEN_POLICY_POPULATION => 'REQUIRES_CITIZEN_POLICY_POPULATION',
            BeneficiaryPolicyEligibilityService::REASON_FAMILY_SUPPORT_STATUS_REVIEW_REQUIRED => 'FAMILY_SUPPORT_STATUS_REVIEW_REQUIRED',
            BeneficiaryPolicyEligibilityService::REASON_MALE_UNDER_40_MEDICAL_REVIEW_REQUIRED => 'MALE_UNDER_40_MEDICAL_REVIEW_REQUIRED',
            BeneficiaryPolicyEligibilityService::REASON_SERVICE_AREA_REVIEW_REQUIRED => 'SERVICE_AREA_REVIEW_REQUIRED',
            BeneficiaryPolicyEligibilityService::REASON_LANDLORD_RELATION_REVIEW_REQUIRED => 'LANDLORD_RELATION_REVIEW_REQUIRED',
            BeneficiaryPolicyEligibilityService::REASON_POLICY_DOCUMENT_REVIEW_REQUIRED => 'POLICY_DOCUMENT_REVIEW_REQUIRED',
            BeneficiaryPolicyEligibilityService::REASON_INELIGIBLE_STATUS => 'INELIGIBLE_BENEFICIARY_STATUS',
            BeneficiaryPolicyEligibilityService::REASON_BENEFICIARY_UNDER_REVIEW => 'BENEFICIARY_UNDER_REVIEW_REQUIRED',
        ];

        foreach ($codes as $constant => $literal) {
            $this->assertSame($literal, $constant);
        }

        $this->assertSame(['eligible', 'ineligible', 'review_required', 'not_applicable'], BeneficiaryPolicyEvaluation::ELIGIBILITY_DECISIONS);
    }

    public function test_resident_citizen_policy_evaluation_returns_not_applicable(): void
    {
        $resident = $this->makeBeneficiary([
            'beneficiary_type' => 'resident', 'nationality' => 'مصرية', 'housing_type' => 'own',
        ]);

        $evaluation = $this->evaluate($resident, $this->publishVersion());

        $this->assertSame('not_applicable', $evaluation->eligibility_decision);
        $this->assertSame([BeneficiaryPolicyEligibilityService::REASON_POLICY_NOT_APPLICABLE_RESIDENT], $evaluation->eligibility_reasons);
        $this->assertNull($evaluation->gross_counted_income);
        $this->assertSame([], $evaluation->financial_snapshot);
    }

    // ── SNAPSHOTS (43–48) ──────────────────────────────────────────────────

    public function test_financial_snapshot_correct_and_complete(): void
    {
        $b = $this->specBeneficiary();
        $version = $this->publishVersion();

        $evaluation = $this->evaluate($b, $version);
        $snap = $evaluation->financial_snapshot;

        $this->assertSame('4200.00', $this->money($snap['counted_gross_monthly_income']));
        $this->assertSame('1500.00', $this->money($snap['monthly_rent']));
        $this->assertSame('annual_preference', $snap['rent_mode']);
        $this->assertSame(5, $snap['family_size']);
        $this->assertSame('500.00', $this->money($snap['family_member_deduction']));
        $this->assertSame('2200.00', $this->money($snap['adjusted_net_household_income']));
        $this->assertSame('440.00', $this->money($snap['net_income_per_capita']));
        $this->assertSame($version->version, $snap['policy_version']);
        $this->assertArrayHasKey('calculated_at', $snap);
        $this->assertArrayHasKey('precision', $snap);

        // First-class columns mirror the snapshot.
        $this->assertSame('4200.00', $this->money($evaluation->gross_counted_income));
        $this->assertSame(5, $evaluation->family_size);
        $this->assertSame('2200.00', $this->money($evaluation->adjusted_net_household_income));
    }

    public function test_income_source_breakdown_preserved_in_snapshot(): void
    {
        $b = $this->makeBeneficiary(['housing_type' => 'own']); // retirement 2000 present, not counted by default

        $evaluation = $this->evaluate($b, $this->publishVersion());
        $sources = $evaluation->financial_snapshot['income_sources'];

        $this->assertSame(['salary', 'social_security', 'citizen_account'], $sources['counted']);
        $this->assertContains('retirement', $sources['available']);
        $this->assertContains('retirement', $sources['not_counted']);
        $this->assertSame(2000.0, (float) $sources['amounts']['retirement']); // JSON round-trip may yield int
        $this->assertArrayNotHasKey('family_support', $sources['amounts']); // absent, not dumped
    }

    public function test_snapshot_privacy_sanitization(): void
    {
        $b = $this->specBeneficiary();
        $evaluation = $this->evaluate($b, $this->publishVersion());

        $input = $evaluation->input_snapshot;
        foreach (['national_id', 'phone', 'iban_encrypted', 'street', 'monthly_salary', 'social_security_amount'] as $sensitive) {
            $this->assertArrayNotHasKey($sensitive, $input, "Sensitive key {$sensitive} leaked into the snapshot.");
        }
        $this->assertSame('head_plus_active_dependents', $input['family_size_derivation']);
        $this->assertSame(4, $input['dependents_count']);
        $this->assertSame('citizen', $input['beneficiary_type']);
    }

    public function test_prior_snapshot_immutable_after_beneficiary_change(): void
    {
        $b = $this->makeBeneficiary(['housing_type' => 'own']);
        $version = $this->publishVersion();

        $before = $this->evaluate($b, $version);
        $beforeSnapshot = $before->financial_snapshot;
        $this->assertSame('4200.00', $this->money($beforeSnapshot['counted_gross_monthly_income']));

        $b->update(['monthly_salary' => 9000]);
        $after = $this->evaluate($b, $version);

        $this->assertSame('10200.00', $this->money($after->financial_snapshot['counted_gross_monthly_income']));
        $this->assertSame($beforeSnapshot, $before->fresh()->financial_snapshot, 'Prior snapshot must stay immutable after beneficiary changes.');
    }

    public function test_prior_snapshot_immutable_after_policy_change(): void
    {
        $b = $this->makeBeneficiary(['housing_type' => 'own']);
        $this->addDependent($b);
        $this->addDependent($b);

        $v1 = $this->publishVersion(['financial' => ['per_family_member_deduction' => 100]]);
        $before = $this->evaluate($b, $v1);
        $beforeSnapshot = $before->financial_snapshot;
        $this->assertSame('review_required', $before->eligibility_decision); // default gates on

        $this->retireVersion($v1);
        $v2 = $this->publishVersion(['financial' => ['per_family_member_deduction' => 300]]);
        $after = $this->evaluate($b, $v2);

        $this->assertSame('900.00', $this->money($after->financial_snapshot['family_member_deduction']));
        $this->assertSame($beforeSnapshot, $before->fresh()->financial_snapshot);
        $this->assertSame($v1->id, $before->fresh()->policy_version_id);
    }

    public function test_policy_c_fields_populated_but_final_decision_stays_unset(): void
    {
        $b = $this->specBeneficiary();
        $evaluation = $this->evaluate($b, $this->publishVersion());

        // POLICY-C now populates the income/score categories (per-capita 440 → B).
        $this->assertSame('b', $evaluation->income_category);
        $this->assertSame('26.0000', $evaluation->policy_score);
        $this->assertSame('b', $evaluation->score_category);
        $this->assertNotNull($evaluation->scoring_snapshot);
        $this->assertSame('policy_review_required', $evaluation->scoring_snapshot['outcome']);
        $this->assertCount(6, $evaluation->scoring_snapshot['components']);
        // No sensitive identity data inside the scoring snapshot.
        $this->assertArrayNotHasKey('national_id', $evaluation->scoring_snapshot['input']);

        // Everything that belongs to later phases stays untouched.
        $this->assertNull($evaluation->final_policy_decision);
        $this->assertNull($evaluation->degree_classification_snapshot);
        $this->assertNull($evaluation->need_level_snapshot);
        $this->assertSame('completed', $evaluation->evaluation_status);
    }

    // ── AUTHORIZATION (49–50) ──────────────────────────────────────────────

    public function test_unauthorized_user_cannot_persist_evaluation(): void
    {
        $b = $this->makeBeneficiary(['housing_type' => 'own']);
        $version = $this->publishVersion();

        // view + edit_draft must NOT be enough to run (persisting) evaluations.
        $viewer = $this->permissionUser(['view' => true, 'edit_draft' => true]);
        $this->postJson('/api/beneficiary-policy/evaluate', [
            'beneficiary_id' => $b->id, 'policy_version_id' => $version->id,
        ])->assertStatus(403);
        $this->assertDatabaseCount('beneficiary_policy_evaluations', 0);
        $this->assertTrue($viewer->is_active);

        // Explicit granular `evaluate` permission unlocks it.
        $this->permissionUser(['view' => true, 'edit_draft' => true, 'evaluate' => true]);
        $this->postJson('/api/beneficiary-policy/evaluate', [
            'beneficiary_id' => $b->id, 'policy_version_id' => $version->id,
        ])->assertOk()->assertJsonPath('data.eligibility_decision', 'review_required');
        $this->assertDatabaseCount('beneficiary_policy_evaluations', 1);
    }

    public function test_edit_draft_permission_isolated_from_publish_and_evaluate(): void
    {
        $this->permissionUser(['view' => true, 'edit_draft' => true]);

        // Draft creation + editing work with edit_draft.
        $draft = $this->postJson('/api/beneficiary-policy/versions', [
            'policy_name' => 'سياسة صرف المساعدات للمستفيدين',
            'version' => '2', 'policy_scope' => 'citizen_beneficiaries',
            'effective_from' => '2027-01-01',
            'configuration' => ['financial' => ['counted_income_sources' => ['salary']]],
        ])->assertCreated()->json('data.id');
        $this->patchJson('/api/beneficiary-policy/versions/'.$draft, ['configuration' => ['financial' => ['counted_income_sources' => ['salary', 'social_security']]]])->assertOk();

        // Lifecycle actions remain isolated.
        $this->postJson('/api/beneficiary-policy/versions/'.$draft.'/approve', ['board_approval_reference' => 'قرار', 'board_approval_date' => '2026-09-20'])->assertStatus(403);
        $this->postJson('/api/beneficiary-policy/versions/'.$draft.'/publish')->assertStatus(403);
        $this->postJson('/api/beneficiary-policy/evaluate', ['beneficiary_id' => '00000000-0000-0000-0000-000000000000', 'policy_version_id' => $draft])->assertStatus(403);
    }

    // ── PHASE REGRESSIONS (53–55) ──────────────────────────────────────────

    public function test_phase2a_policy_lifecycle_regression_via_api(): void
    {
        $created = $this->postJson('/api/beneficiary-policy/versions', [
            'policy_name' => 'سياسة صرف المساعدات للمستفيدين',
            'version' => '7', 'policy_scope' => 'citizen_beneficiaries',
            'effective_from' => '2026-12-01',
            'configuration' => ['financial' => ['counted_income_sources' => ['salary']]],
        ])->assertCreated()->json('data.id');
        $this->postJson('/api/beneficiary-policy/versions/'.$created.'/approve', ['board_approval_reference' => 'قرار 7/2026', 'board_approval_date' => '2026-09-20'])->assertOk();
        $this->postJson('/api/beneficiary-policy/versions/'.$created.'/publish')->assertOk();
        $this->getJson('/api/beneficiary-policy/versions/'.$created.'/history')->assertOk();
        $this->postJson('/api/beneficiary-policy/versions/'.$created.'/retire', ['change_reason' => 'انتهاء'])->assertOk();
    }

    public function test_phase2b_support_engine_regression(): void
    {
        $stock = InventoryItem::create(['name' => 'TEST rice', 'unit' => 'kg', 'current_quantity' => 100, 'min_threshold' => 1]);
        $location = PickupLocation::create(['name' => 'TEST pickup']);
        $org = Organization::create(['name' => 'TEST org', 'code' => 'TEST_ORG_2B', 'status' => 'active']);

        $id = $this->postJson('/api/support/distributions', [
            'recipient_type' => 'organization', 'organization_id' => $org->id,
            'fulfillment_method' => 'pickup', 'pickup_location_id' => $location->id,
            'items' => [['inventory_item_id' => $stock->id, 'requested_quantity' => '5']],
        ])->assertCreated()->json('data.id');

        foreach (['approve', 'reserve', 'ready'] as $action) {
            $this->patchJson('/api/support/distributions/'.$id.'/'.$action)->assertOk();
        }

        $this->assertDatabaseHas('support_distributions', ['id' => $id]);
        $this->assertSame('5.00', $stock->fresh()->reserved_quantity);
    }

    public function test_policy_a_evaluation_invariants_regression(): void
    {
        $b = $this->makeBeneficiary(['housing_type' => 'own']);
        $version = $this->publishVersion();

        $evaluation = $this->evaluate($b, $version);
        $stored = $evaluation->fresh();

        $this->assertSame($b->id, $stored->beneficiary_id);
        $this->assertSame($version->id, $stored->policy_version_id);
        $this->assertSame($this->admin->id, $stored->evaluated_by);
        $this->assertNotNull($stored->evaluated_at);
        $this->assertSame('completed', $stored->evaluation_status);

        // POLICY-A contract: evaluation snapshots are created once and never mutated
        // through any exposed route — no mutating EVALUATION route may exist
        // (draft version editing remains a separate, legitimate POLICY-A route).
        $evaluationRoutes = collect(app('router')->getRoutes()->getRoutesByMethod())
            ->flatMap(fn ($routes) => $routes)
            ->filter(fn ($route) => str_contains($route->uri(), 'beneficiary-policy')
                && str_contains($route->uri(), 'evaluation'))
            ->filter(fn ($route) => in_array('PATCH', $route->methods(), true) || in_array('DELETE', $route->methods(), true))
            ->map(fn ($route) => $route->uri().' '.implode(',', $route->methods()));
        $this->assertSame([], $evaluationRoutes->values()->all(), 'No mutating evaluation routes may exist.');
    }
}
