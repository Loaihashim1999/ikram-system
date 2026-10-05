<?php

namespace Tests\Feature;

use App\Models\Beneficiary;
use App\Models\BeneficiaryPolicyVersion;
use App\Models\InventoryItem;
use App\Models\Organization;
use App\Models\PickupLocation;
use App\Models\User;
use App\Services\BeneficiaryPolicy\BeneficiaryPolicyVersionService;
use App\Services\BeneficiaryPolicy\PolicyConfigurationValidator;
use App\Services\BeneficiaryPolicy\PolicyExceptionService;
use App\Services\BeneficiaryPolicy\PolicyFinancialEvaluationService;
use App\Services\BeneficiaryPolicy\PolicyIncomeCategoriesService;
use App\Services\BeneficiaryPolicy\PolicyOutcomeService;
use App\Services\BeneficiaryPolicy\PolicyScoringService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * POLICY-C — exceptions, snapshot immutability, authorization & regression
 * (authorization mandate tests 64–83).
 */
class PolicyCExceptionsSnapshotAuthTest extends TestCase
{
    use RefreshDatabase;

    protected BeneficiaryPolicyVersionService $versions;

    protected PolicyFinancialEvaluationService $evaluator;

    protected PolicyExceptionService $exceptions;

    protected int $nationalSeq = 0;

    protected User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->versions = app(BeneficiaryPolicyVersionService::class);
        $this->evaluator = app(PolicyFinancialEvaluationService::class);
        $this->exceptions = app(PolicyExceptionService::class);
        $this->admin = User::create([
            'username' => 'TEST_POLICYC_EXCEPT', 'full_name' => 'Policy C Exception Admin',
            'password' => 'test-password', 'email' => 'policyc-exception@example.invalid',
            'role' => 'admin', 'is_active' => true,
        ]);
        Sanctum::actingAs($this->admin);
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    protected function defaults(): array
    {
        return PolicyConfigurationValidator::withDefaults([]);
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

    protected function permissionUser(array $perms, string $role = 'assistant_admin'): User
    {
        $user = User::create([
            'username' => 'TEST_POLICYC_'.strtoupper(substr(md5(uniqid('', true)), 0, 8)),
            'full_name' => 'Policy C User', 'password' => 'test-password',
            'email' => 'policyc-user-'.substr(md5(uniqid('', true)), 0, 12).'@example.invalid', 'role' => $role,
            'permissions' => ['beneficiary_policy' => $perms], 'is_active' => true,
        ]);
        Sanctum::actingAs($user);

        return $user;
    }

    // ── 64–69: EXCEPTION REGISTRY ──────────────────────────────────────────

    public function test_orphan_mother_exception_in_defaults(): void
    {
        $rules = $this->defaults()['exceptions']['rules'];
        $this->assertNotEmpty($rules);
        $rule = $rules[0];
        $this->assertSame('orphan_mother', $rule['code']);
        $this->assertTrue($rule['enabled']);
        $this->assertSame(1200.0, (float) $rule['income_ceiling']);
        $this->assertTrue($rule['requires_manual_review']);
        $this->assertSame('family_status', $rule['condition']['field']);
        $this->assertSame('in', $rule['condition']['operator']);
        // Default authoritative structured match is widow_with_orphans ONLY — a
        // generic 'widow' is never auto-matched by the default exception.
        $this->assertSame(['widow_with_orphans'], $rule['condition']['values']);
    }

    public function test_exception_ceiling_configurable(): void
    {
        $validated = PolicyConfigurationValidator::validate([
            'exceptions' => ['rules' => [[
                'code' => 'orphan_mother', 'enabled' => true, 'label' => 'أم يتيم',
                'income_ceiling' => 1500, 'requires_manual_review' => true,
                'condition' => ['field' => 'family_status', 'operator' => 'in', 'values' => ['widow_with_orphans']],
            ]]],
        ]);
        $this->assertSame(1500.0, (float) $validated['exceptions']['rules'][0]['income_ceiling']);

        // Personalized ceiling now admits a higher verifier-supplied income.
        $result = $this->exceptions->evaluate('widow_with_orphans', 1450.0, $validated['exceptions']['rules'], 1000.0);
        $this->assertNotSame(PolicyExceptionService::STATUS_NOT_APPLICABLE, $result['status']);
    }

    public function test_above_threshold_within_ceiling_review_required_by_default(): void
    {
        $rules = $this->defaults()['exceptions']['rules'];

        $result = $this->exceptions->evaluate('widow_with_orphans', 1100.0, $rules, 1000.0);
        $this->assertSame(PolicyExceptionService::STATUS_REVIEW_REQUIRED, $result['status']);
        $this->assertSame('orphan_mother', $result['code']);
        $this->assertSame(PolicyExceptionService::REASON_EVIDENCE_REVIEW_REQUIRED, $result['reason']);

        // Orchestrated end-to-end with a widow_with_orphans head (per-capita 1100).
        $b = $this->makeBeneficiary(['family_status' => 'widow_with_orphans', 'monthly_salary' => 1200]);
        $evaluation = $this->evaluator->evaluate($b->id, $this->publishVersion()->id, $this->admin->id);
        $this->assertSame('excluded', $evaluation->income_category);
        $this->assertSame('orphan_mother', $evaluation->exception_code);
        $details = json_decode($evaluation->exception_details, true);
        $this->assertSame(PolicyExceptionService::STATUS_REVIEW_REQUIRED, $details['status']);
        $this->assertSame(PolicyOutcomeService::OUTCOME_EXCEPTION_REVIEW_REQUIRED, $evaluation->scoring_snapshot['outcome']);
        $this->assertNull($evaluation->final_policy_decision);
    }

    public function test_auto_applied_exception_when_config_is_authoritative(): void
    {
        $validated = PolicyConfigurationValidator::validate([
            'exceptions' => ['rules' => [[
                'code' => 'orphan_mother', 'enabled' => true, 'label' => 'أم يتيم',
                'income_ceiling' => 1200, 'requires_manual_review' => false,
                'condition' => ['field' => 'family_status', 'operator' => 'in', 'values' => ['widow_with_orphans']],
            ]]],
        ]);

        $result = $this->exceptions->evaluate('widow_with_orphans', 1100.0, $validated['exceptions']['rules'], 1000.0);
        $this->assertSame(PolicyExceptionService::STATUS_APPLICABLE, $result['status']);
        $this->assertSame('orphan_mother', $result['code']);
        $this->assertNull($result['reason']);
    }

    public function test_missing_exception_evidence_review_required(): void
    {
        $rules = $this->defaults()['exceptions']['rules'];

        // family_status unknown (null) → proof is impossible → review, never a guess.
        $result = $this->exceptions->evaluate(null, 1100.0, $rules, 1000.0);
        $this->assertSame(PolicyExceptionService::STATUS_REVIEW_REQUIRED, $result['status']);
        $this->assertSame(PolicyExceptionService::REASON_EVIDENCE_REVIEW_REQUIRED, $result['reason']);

        // A family status outside the condition is genuinely not an orphan-mother case.
        $notMatched = $this->exceptions->evaluate('divorced', 1100.0, $rules, 1000.0);
        $this->assertSame(PolicyExceptionService::STATUS_NOT_APPLICABLE, $notMatched['status']);
    }

    public function test_generic_widow_not_auto_matched_review_required(): void
    {
        $rules = $this->defaults()['exceptions']['rules'];

        // A canonical generic 'widow' is NOT 'widow_with_orphans': orphan status is
        // not provable from the enum alone → review_required with the stable evidence
        // reason — never a silent auto-application of the 1200 SAR ceiling.
        $result = $this->exceptions->evaluate('widow', 1100.0, $rules, 1000.0);
        $this->assertSame(PolicyExceptionService::STATUS_REVIEW_REQUIRED, $result['status']);
        $this->assertSame('orphan_mother', $result['code']);
        $this->assertSame(PolicyExceptionService::REASON_EVIDENCE_REVIEW_REQUIRED, $result['reason']);

        // End-to-end: an on-record generic widow above the threshold stays in review.
        $b = $this->makeBeneficiary(['family_status' => 'widow', 'monthly_salary' => 1200]);
        $evaluation = $this->evaluator->evaluate($b->id, $this->publishVersion()->id, $this->admin->id);
        $details = json_decode($evaluation->exception_details, true);
        $this->assertSame(PolicyExceptionService::STATUS_REVIEW_REQUIRED, $details['status']);
        $this->assertSame(PolicyExceptionService::REASON_EVIDENCE_REVIEW_REQUIRED, $details['reason']);
        $this->assertSame(PolicyOutcomeService::OUTCOME_EXCEPTION_REVIEW_REQUIRED, $evaluation->scoring_snapshot['outcome']);
        $this->assertNull($evaluation->final_policy_decision);
    }

    public function test_authoritative_orphan_evidence_makes_generic_widow_candidate(): void
    {
        // With authoritative structured orphan evidence the generic widow becomes an
        // orphan-mother candidate (still manual-review gated by the default config).
        $result = $this->exceptions->evaluate('widow', 1100.0, $this->defaults()['exceptions']['rules'], 1000.0, true);
        $this->assertSame(PolicyExceptionService::STATUS_REVIEW_REQUIRED, $result['status']);
        $this->assertSame('orphan_mother', $result['code']);

        // Under an authoritative (requires_manual_review=false) config the proved
        // case auto-applies — evidence, not the bare enum, decides.
        $validated = PolicyConfigurationValidator::validate([
            'exceptions' => ['rules' => [[
                'code' => 'orphan_mother', 'enabled' => true, 'label' => 'أم يتيم',
                'income_ceiling' => 1200, 'requires_manual_review' => false,
                'condition' => ['field' => 'family_status', 'operator' => 'in', 'values' => ['widow_with_orphans']],
            ]]],
        ]);
        $applied = $this->exceptions->evaluate('widow', 1100.0, $validated['exceptions']['rules'], 1000.0, true);
        $this->assertSame(PolicyExceptionService::STATUS_APPLICABLE, $applied['status']);
        $this->assertSame('orphan_mother', $applied['code']);
    }

    public function test_published_broad_widow_condition_honored_as_immutable(): void
    {
        // A published version that explicitly broadened the orphan-mother condition
        // to include generic 'widow' remains verbatim: honored by the engine and
        // never silently rewritten by the corrected defaults.
        $validated = PolicyConfigurationValidator::validate([
            'exceptions' => ['rules' => [[
                'code' => 'orphan_mother', 'enabled' => true, 'label' => 'أم يتيم',
                'income_ceiling' => 1200, 'requires_manual_review' => false,
                'condition' => ['field' => 'family_status', 'operator' => 'in', 'values' => ['widow_with_orphans', 'widow']],
            ]]],
        ]);
        $version = $this->publishVersion(['exceptions' => $validated['exceptions']]);
        $b = $this->makeBeneficiary(['family_status' => 'widow', 'monthly_salary' => 1200]);
        $evaluation = $this->evaluator->evaluate($b->id, $version->id, $this->admin->id);

        $details = json_decode($evaluation->exception_details, true);
        $this->assertSame(PolicyExceptionService::STATUS_APPLICABLE, $details['status']);
        $this->assertSame('orphan_mother', $evaluation->exception_code);

        // The immutable published configuration still contains its broadened values.
        $stored = $version->fresh()->configuration['exceptions']['rules'][0]['condition']['values'];
        $this->assertSame(['widow_with_orphans', 'widow'], $stored);
    }

    public function test_historical_snapshot_unchanged_after_correction(): void
    {
        // v1: broad published condition (generic widow included), manual review on —
        // immutable history captured under the old configuration path.
        $v1 = $this->publishVersion(['exceptions' => ['rules' => [[
            'code' => 'orphan_mother', 'enabled' => true, 'label' => 'أم يتيم',
            'income_ceiling' => 1200, 'requires_manual_review' => true,
            'condition' => ['field' => 'family_status', 'operator' => 'in', 'values' => ['widow_with_orphans', 'widow']],
        ]]]]);
        $b = $this->makeBeneficiary(['family_status' => 'widow', 'monthly_salary' => 1200]);
        $e1 = $this->evaluator->evaluate($b->id, $v1->id, $this->admin->id);
        $details1 = json_decode($e1->exception_details, true);
        $this->assertSame(PolicyExceptionService::STATUS_REVIEW_REQUIRED, $details1['status']); // broad condition + manual review
        $snapshot1 = $e1->scoring_snapshot;

        // v2: corrected defaults (widow_with_orphans ONLY) — future evaluations only.
        $this->versions->retire($v1->id, ['change_reason' => 'تصحيح افتراضي'], $this->admin->id);
        $v2 = $this->publishVersion();
        $e2 = $this->evaluator->evaluate($b->id, $v2->id, $this->admin->id);
        $details2 = json_decode($e2->exception_details, true);
        $this->assertSame(PolicyExceptionService::STATUS_REVIEW_REQUIRED, $details2['status']); // corrected path: generic widow unresolved
        $this->assertSame('orphan_mother', $e2->exception_code);

        $e1f = $e1->fresh();
        $this->assertSame('orphan_mother', $e1f->exception_code);
        $this->assertSame($details1['status'], json_decode($e1f->exception_details, true)['status']);
        $this->assertEquals($snapshot1, $e1f->scoring_snapshot);
        $this->assertContains('widow', $v1->fresh()->configuration['exceptions']['rules'][0]['condition']['values']);
    }

    public function test_disabled_exception_keeps_normal_rule(): void
    {
        $rules = array_map(static fn (array $rule) => array_merge($rule, ['enabled' => false]), $this->defaults()['exceptions']['rules']);
        $result = $this->exceptions->evaluate('widow_with_orphans', 1100.0, $rules, 1000.0);
        $this->assertSame(PolicyExceptionService::STATUS_NOT_APPLICABLE, $result['status']);

        // Orchestrated: exclusion stands → financially_excluded.
        $b = $this->makeBeneficiary(['family_status' => 'widow_with_orphans', 'monthly_salary' => 1200]);
        $version = $this->publishVersion(['exceptions' => ['rules' => array_map(
            static fn (array $r) => array_merge($r, ['enabled' => false]),
            $this->defaults()['exceptions']['rules'],
        )]]);
        $evaluation = $this->evaluator->evaluate($b->id, $version->id, $this->admin->id);
        $this->assertSame(PolicyIncomeCategoriesService::STATUS_EXCLUDED, $evaluation->scoring_snapshot['income']['status']);
        $this->assertSame(PolicyOutcomeService::OUTCOME_FINANCIALLY_EXCLUDED, $evaluation->scoring_snapshot['outcome']);
        $this->assertNull($evaluation->exception_code);
    }

    public function test_historical_exception_result_preserved_after_new_policy_version(): void
    {
        $b = $this->makeBeneficiary(['family_status' => 'widow_with_orphans', 'monthly_salary' => 1200]);

        $v1 = $this->publishVersion();
        $e1 = $this->evaluator->evaluate($b->id, $v1->id, $this->admin->id);
        $this->assertSame('orphan_mother', $e1->exception_code);

        $this->versions->retire($v1->id, ['change_reason' => 'استبدال'], $this->admin->id);
        $v2 = $this->publishVersion(['exceptions' => ['rules' => array_map(
            static fn (array $r) => array_merge($r, ['enabled' => false]),
            $this->defaults()['exceptions']['rules'],
        )]]);
        $e2 = $this->evaluator->evaluate($b->id, $v2->id, $this->admin->id);

        $this->assertNull($e2->exception_code); // disabled under v2
        $this->assertSame($e1->exception_code, $e1->fresh()->exception_code); // v1 snapshot immutable
        $this->assertSame($e1->exception_details, $e1->fresh()->exception_details);
        $this->assertNotSame($e1->exception_code, $e2->exception_code);
    }

    // ── 70–75: SNAPSHOTS ───────────────────────────────────────────────────

    public function test_scoring_breakdown_persisted(): void
    {
        $b = $this->makeBeneficiary();
        $evaluation = $this->evaluator->evaluate($b->id, $this->publishVersion()->id, $this->admin->id);

        $components = $evaluation->scoring_snapshot['components'];
        $this->assertCount(6, $components);
        foreach ($components as $component) {
            $this->assertArrayHasKey('dimension', $component);
            $this->assertArrayHasKey('input', $component);
            $this->assertArrayHasKey('rule', $component);
            $this->assertArrayHasKey('points', $component);
            $this->assertArrayHasKey('review_required', $component);
            $this->assertArrayHasKey('reason', $component);
        }
        $this->assertArrayHasKey('max_score', $evaluation->scoring_snapshot['config']);
        $this->assertArrayHasKey('policy_version_id', $evaluation->scoring_snapshot['config']);
    }

    public function test_policy_score_persisted_as_number(): void
    {
        $b = $this->makeBeneficiary(); // per-capita 900 → income 5 + age 5 = 10
        $evaluation = $this->evaluator->evaluate($b->id, $this->publishVersion()->id, $this->admin->id);
        $this->assertSame('10.0000', $evaluation->policy_score);
        $this->assertSame(10.0, (float) $evaluation->scoring_snapshot['total_score']);
    }

    public function test_income_and_score_categories_persisted_separately(): void
    {
        $b = $this->makeBeneficiary();
        $evaluation = $this->evaluator->evaluate($b->id, $this->publishVersion()->id, $this->admin->id);

        $this->assertSame('d', $evaluation->income_category);
        $this->assertSame('c', $evaluation->score_category);
        $this->assertSame('d', $evaluation->scoring_snapshot['income']['category']);
        $this->assertSame('c', $evaluation->scoring_snapshot['score_category']);
    }

    public function test_previous_snapshot_immutable_after_policy_change(): void
    {
        $b = $this->makeBeneficiary();
        $v1 = $this->publishVersion();
        $e1 = $this->evaluator->evaluate($b->id, $v1->id, $this->admin->id);
        $snapshot = $e1->scoring_snapshot;

        $this->versions->retire($v1->id, ['change_reason' => 'استبدال'], $this->admin->id);
        $v2 = $this->publishVersion(['financial' => ['counted_income_sources' => ['salary'], 'per_family_member_deduction' => 300]]);
        $this->evaluator->evaluate($b->id, $v2->id, $this->admin->id);

        $this->assertEquals($snapshot, $e1->fresh()->scoring_snapshot);
        $this->assertSame('10.0000', $e1->fresh()->policy_score);
    }

    public function test_missing_data_review_codes_persisted(): void
    {
        $b = $this->makeBeneficiary();
        $evaluation = $this->evaluator->evaluate($b->id, $this->publishVersion()->id, $this->admin->id);

        $reviews = $evaluation->scoring_snapshot['reviews'];
        $this->assertContains(PolicyScoringService::REASON_HOUSING_CONDITION_REVIEW, $reviews);
        $this->assertContains(PolicyScoringService::REASON_HEAD_HEALTH_REVIEW, $reviews);
        $this->assertContains(PolicyScoringService::REASON_CHILDREN_HEALTH_REVIEW, $reviews);
        $this->assertSame(PolicyOutcomeService::OUTCOME_POLICY_REVIEW_REQUIRED, $evaluation->scoring_snapshot['outcome']);
    }

    public function test_no_sensitive_evidence_copied_into_snapshot(): void
    {
        $b = $this->makeBeneficiary();
        $evaluation = $this->evaluator->evaluate($b->id, $this->publishVersion()->id, $this->admin->id);

        $snapshotKeys = array_keys($evaluation->scoring_snapshot['input']);
        foreach (['national_id', 'iban_encrypted', 'phone', 'provider_secret'] as $sensitive) {
            $this->assertNotContains($sensitive, $snapshotKeys);
        }
        $this->assertArrayNotHasKey('national_id', $evaluation->financial_snapshot);
        $this->assertArrayNotHasKey('national_id', $evaluation->input_snapshot);
    }

    // ── 76–78: AUTHORIZATION ───────────────────────────────────────────────

    public function test_unauthorized_evaluation_denied(): void
    {
        $version = $this->publishVersion();
        $b = $this->makeBeneficiary();
        $this->app->make('auth')->forgetGuards();

        $this->postJson('/api/beneficiary-policy/evaluate', [
            'beneficiary_id' => $b->id, 'policy_version_id' => $version->id,
        ])->assertStatus(401);
    }

    public function test_view_permission_cannot_persist_scoring(): void
    {
        $this->permissionUser(['view' => true]);
        $version = $this->publishVersion();
        $b = $this->makeBeneficiary();

        $this->postJson('/api/beneficiary-policy/evaluate', [
            'beneficiary_id' => $b->id, 'policy_version_id' => $version->id,
        ])->assertStatus(403);
        $this->assertDatabaseCount('beneficiary_policy_evaluations', 0);
    }

    public function test_draft_editor_permissions_distinct_from_publish_and_evaluate(): void
    {
        $this->permissionUser(['view' => true, 'edit_draft' => true]);

        $draft = $this->postJson('/api/beneficiary-policy/versions', [
            'policy_name' => 'سياسة صرف المساعدات للمستفيدين',
            'version' => 'P', 'policy_scope' => 'citizen_beneficiaries',
            'effective_from' => '2027-01-01',
            'configuration' => ['financial' => ['counted_income_sources' => ['salary']]],
        ])->assertCreated()->json('data.id');

        // Draft scoring configuration edits work…
        $this->patchJson('/api/beneficiary-policy/versions/'.$draft, [
            'configuration' => ['income_categories' => $this->defaults()['income_categories']],
        ])->assertOk();

        // …but publishing and evaluating stay locked behind their own permissions.
        $this->postJson('/api/beneficiary-policy/versions/'.$draft.'/approve', ['board_approval_reference' => 'قرار', 'board_approval_date' => '2026-09-20'])->assertStatus(403);
        $b = $this->makeBeneficiary();
        $this->postJson('/api/beneficiary-policy/evaluate', [
            'beneficiary_id' => $b->id, 'policy_version_id' => $draft,
        ])->assertStatus(403);
        $this->assertDatabaseCount('beneficiary_policy_evaluations', 0);
    }

    // ── 79–83: REGRESSION ─────────────────────────────────────────────────

    public function test_policy_b_financial_outputs_unchanged(): void
    {
        $b = $this->makeBeneficiary(['housing_type' => 'rent', 'annual_rent_amount' => 18000, 'social_security_amount' => 700, 'citizen_account_amount' => 500, 'monthly_salary' => 3000]);
        foreach (range(1, 4) as $i) {
            $this->addDependent($b);
        }

        $evaluation = $this->evaluator->evaluate($b->id, $this->publishVersion()->id, $this->admin->id);

        $financials = $evaluation->financial_snapshot;
        $this->assertSame('4200.00', $this->moneyStr($financials['counted_gross_monthly_income']));
        $this->assertSame('1500.00', $this->moneyStr($financials['monthly_rent']));
        $this->assertSame(5, $financials['family_size']);
        $this->assertSame('500.00', $this->moneyStr($financials['family_member_deduction']));
        $this->assertSame('2200.00', $this->moneyStr($financials['adjusted_net_household_income']));
        $this->assertSame('440.00', $this->moneyStr($financials['net_income_per_capita']));
        $this->assertSame('b', $evaluation->income_category); // 440 → B
        $this->assertSame('review_required', $evaluation->eligibility_decision);
    }

    public function test_resident_calculation_unchanged(): void
    {
        $b = $this->makeBeneficiary(['beneficiary_type' => 'resident']);
        $evaluation = $this->evaluator->evaluate($b->id, $this->publishVersion()->id, $this->admin->id);

        $this->assertSame('not_applicable', $evaluation->eligibility_decision);
        $this->assertNull($evaluation->income_category);
        $this->assertSame([], $evaluation->scoring_snapshot); // array cast of unset null
        $this->assertSame([], $evaluation->financial_snapshot);
    }

    public function test_policy_a_lifecycle_remains_green(): void
    {
        $b = $this->makeBeneficiary();
        $version = $this->makeVersion(['income_categories' => $this->defaults()['income_categories']]);
        $this->versions->approve($version->id, ['board_approval_reference' => 'قرار 1/2026', 'board_approval_date' => '2026-09-20'], $this->admin->id);
        $this->versions->publish($version->id, $this->admin->id);

        $this->assertSame('published', $version->fresh()->status);
        $evaluation = $this->evaluator->evaluate($b->id, $version->fresh()->id, $this->admin->id);
        $this->assertSame('completed', $evaluation->evaluation_status);

        $this->versions->retire($version->fresh()->id, ['change_reason' => 'انتهاء'], $this->admin->id);
        $this->assertSame('retired', $version->fresh()->status);
        $this->assertDatabaseHas('beneficiary_policy_evaluations', ['beneficiary_id' => $b->id]);
    }

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

    public function test_phase2b_delivery_regression(): void
    {
        $stock = InventoryItem::create(['name' => 'TEST rice', 'unit' => 'kg', 'current_quantity' => 100, 'min_threshold' => 1]);
        $location = PickupLocation::create(['name' => 'TEST pickup']);
        $org = Organization::create(['name' => 'TEST org', 'code' => 'TEST_ORG_2B_POLICYC', 'status' => 'active']);

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

    // ── helpers ────────────────────────────────────────────────────────────

    private function moneyStr(mixed $value): string
    {
        return sprintf('%.2f', (float) $value);
    }
}
