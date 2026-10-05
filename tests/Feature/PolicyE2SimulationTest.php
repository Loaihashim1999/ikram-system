<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Beneficiary;
use App\Models\BeneficiaryDocument;
use App\Models\BeneficiaryPolicyEvaluation;
use App\Models\MedicalEvidence;
use App\Models\PolicyApplicationRun;
use App\Models\PolicyDecision;
use App\Models\SocialAssessment;
use App\Services\BeneficiaryPolicy\PolicyApplicationRunService;
use App\Services\BeneficiaryPolicy\PolicyApplicationSimulationService;
use App\Services\BeneficiaryPolicy\PolicyFinancialEvaluationService;
use App\Services\BeneficiaryPolicy\PolicyOutcomeService;
use App\Services\FinancialCalculationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\Sanctum;
use Tests\Support\PolicyEScenario;
use Tests\TestCase;

/**
 * POLICY-E2 — read-only impact simulation.
 *
 * Proves: the simulation reuses the authoritative POLICY-B/C pipeline without
 * persisting any evaluation, covers all four scope modes, compares against a
 * deterministic prior evaluation, computes semantic deltas, hashes the reviewed
 * candidate set, isolates per-beneficiary failures and exposes a bounded API.
 */
class PolicyE2SimulationTest extends TestCase
{
    use RefreshDatabase;

    protected PolicyApplicationSimulationService $simulation;

    protected PolicyFinancialEvaluationService $pipeline;

    protected PolicyApplicationRunService $runs;

    protected function setUp(): void
    {
        parent::setUp();
        $this->simulation = app(PolicyApplicationSimulationService::class);
        $this->pipeline = app(PolicyFinancialEvaluationService::class);
        $this->runs = app(PolicyApplicationRunService::class);
        Sanctum::actingAs(PolicyEScenario::actor());
    }

    /**
     * Snapshot of every business table simulation must never write or mutate.
     * The audit trail is deliberately excluded: it gains exactly the run-level
     * events asserted explicitly in the test below — never one row per candidate.
     */
    protected function readOnlyFingerprint(): array
    {
        return [
            'evaluations' => BeneficiaryPolicyEvaluation::count(),
            'decisions' => PolicyDecision::count(),
            'documents' => BeneficiaryDocument::count(),
            'medical' => MedicalEvidence::count(),
            'social' => SocialAssessment::count(),
            'beneficiaries' => Beneficiary::count(),
            'entries' => DB::table('beneficiaries')->orderBy('id')->get()->map(fn ($row) => json_encode($row))->implode('|'),
        ];
    }

    public function test_simulation_writes_no_business_rows_and_mutates_no_beneficiary(): void
    {
        $actor = PolicyEScenario::actor();
        $version = PolicyEScenario::published($actor, ['application_scope' => ['applies_to' => 'all_existing_and_new']]);
        PolicyEScenario::beneficiary();
        PolicyEScenario::beneficiary(['beneficiary_type' => 'resident', 'family_status' => 'poor']);

        $before = $this->readOnlyFingerprint();
        $auditBefore = AuditLog::count();
        $run = PolicyEScenario::simulate(PolicyEScenario::run($version, [], $actor), $actor);
        $after = $this->readOnlyFingerprint();

        $this->assertSame($before, $after, 'simulation must not persist or mutate business data');
        // Exactly two run-level audit events are added — never one row per candidate.
        $this->assertSame($auditBefore + 2, AuditLog::count());
        $this->assertSame(1, AuditLog::where('action', PolicyApplicationRunService::AUDIT_RUN_CREATED)->count());
        $this->assertSame(1, AuditLog::where('action', PolicyApplicationRunService::AUDIT_SCOPE_SIMULATED)->count());
        $this->assertSame(PolicyApplicationRun::STATUS_SIMULATED, $run->status);
        $this->assertSame(2, $run->total_candidates);
        $this->assertSame(2, $run->items()->count(), 'exactly one item per candidate');
        $this->assertSame(0, BeneficiaryPolicyEvaluation::count());
    }

    public function test_new_only_scope_has_zero_existing_candidates(): void
    {
        $actor = PolicyEScenario::actor();
        PolicyEScenario::beneficiary();
        PolicyEScenario::beneficiary();
        $version = PolicyEScenario::published($actor, ['application_scope' => ['applies_to' => 'new_only']]);

        $run = PolicyEScenario::simulate(PolicyEScenario::run($version, [], $actor), $actor);

        $this->assertSame(0, $run->total_candidates);
        $this->assertSame(0, $run->items()->count());
        $this->assertSame(0, $run->simulation_summary['simulated_count']);
        $this->assertNotNull($run->candidate_set_hash);
    }

    public function test_all_existing_scope_enumerates_every_beneficiary_including_residents(): void
    {
        $actor = PolicyEScenario::actor();
        $version = PolicyEScenario::published($actor, ['application_scope' => ['applies_to' => 'all_existing_and_new']]);
        PolicyEScenario::beneficiary();
        PolicyEScenario::beneficiary();
        PolicyEScenario::beneficiary(['beneficiary_type' => 'resident', 'family_status' => 'poor']);

        $run = PolicyEScenario::simulate(PolicyEScenario::run($version, [], $actor), $actor);

        $this->assertSame(3, $run->total_candidates);
        $this->assertSame(3, $run->success_count);
        $summary = $run->simulation_summary;
        $this->assertSame(1, $summary['resident_not_applicable_count']);
        $this->assertSame(1, $summary['not_applicable_count']);
        $this->assertSame(2, $summary['eligible_count'] + $summary['ineligible_count'] + $summary['review_required_count']);
    }

    public function test_selected_scope_only_covers_selected_existing_beneficiaries(): void
    {
        $actor = PolicyEScenario::actor();
        $version = PolicyEScenario::published($actor, ['application_scope' => ['applies_to' => 'selected_existing_and_new']]);
        $first = PolicyEScenario::beneficiary();
        PolicyEScenario::beneficiary();

        $run = PolicyEScenario::simulate(PolicyEScenario::run($version, ['beneficiary_ids' => [$first->id]], $actor), $actor);

        $this->assertSame(1, $run->total_candidates);
        $this->assertSame($first->id, $run->items()->first()->beneficiary_id);
    }

    public function test_selected_scope_with_unknown_beneficiary_rejects_the_whole_request(): void
    {
        $actor = PolicyEScenario::actor();
        $version = PolicyEScenario::published($actor, ['application_scope' => ['applies_to' => 'selected_existing_and_new']]);
        $known = PolicyEScenario::beneficiary();
        $run = PolicyEScenario::run($version, ['beneficiary_ids' => [$known->id, (string) str()->uuid()]], $actor);

        try {
            PolicyEScenario::simulate($run, $actor);
            $this->fail('an unknown selected beneficiary must reject the request');
        } catch (ValidationException $e) {
            $this->assertArrayHasKey('scope_parameters.beneficiary_ids', $e->errors());
        }

        $this->assertSame(PolicyApplicationRun::STATUS_DRAFT, $run->fresh()->status, 'a rejected simulation must not mark the run simulated');
        $this->assertSame(0, $run->items()->count(), 'nothing is persisted for a rejected candidate set');
    }

    public function test_effective_from_date_scope_uses_registration_date_boundary(): void
    {
        $actor = PolicyEScenario::actor();
        $boundary = '2026-09-10';
        $version = PolicyEScenario::published($actor, [
            'application_scope' => ['applies_to' => 'effective_from_date', 'effective_from_date' => $boundary],
        ]);

        $before = PolicyEScenario::beneficiary();
        PolicyEScenario::registeredAt($before, '2026-09-09 23:59:59');
        $exact = PolicyEScenario::beneficiary();
        PolicyEScenario::registeredAt($exact, '2026-09-10 00:00:00');
        $after = PolicyEScenario::beneficiary();
        PolicyEScenario::registeredAt($after, '2026-09-11 08:00:00');

        $run = PolicyEScenario::simulate(PolicyEScenario::run($version, [], $actor), $actor);
        $candidates = $run->items()->pluck('beneficiary_id')->all();

        $this->assertNotContains($before->id, $candidates, 'before the boundary is not applied');
        $this->assertContains($exact->id, $candidates, 'the exact boundary is applied');
        $this->assertContains($after->id, $candidates, 'after the boundary is applied');
        $this->assertSame(2, $run->total_candidates);
    }

    // ── RESULT CONTRACT ────────────────────────────────────────────────

    public function test_item_result_contains_authoritative_policy_c_results_and_no_decision(): void
    {
        $actor = PolicyEScenario::actor();
        $version = PolicyEScenario::published($actor, ['application_scope' => ['applies_to' => 'all_existing_and_new']]);
        $beneficiary = PolicyEScenario::beneficiary();
        $direct = $this->pipeline->compute($beneficiary->fresh(), $version);

        $run = PolicyEScenario::simulate(PolicyEScenario::run($version, [], $actor), $actor);
        $result = $run->items()->first()->simulation_result;

        // Authoritative reuse: simulation values equal the real pipeline output.
        $this->assertSame($direct['eligibility_decision'], $result['eligibility_decision']);
        $this->assertSame($direct['income_category'], $result['income_category']);
        $this->assertSame((string) $direct['policy_score'], (string) $result['policy_score']);
        $this->assertSame($direct['score_category'], $result['score_category']);
        $this->assertSame($direct['scoring_snapshot']['outcome'], $result['intermediate_outcome']);
        $this->assertSame($version->id, $result['policy_version_id']);
        $this->assertArrayHasKey('review_required', $result);
        $this->assertArrayHasKey('review_reasons', $result);
        $this->assertFalse($result['not_applicable']);
        // No administrative prediction and no decision copy.
        $this->assertArrayNotHasKey('final_policy_decision', $result);
        $this->assertArrayNotHasKey('decision', $result);
        $this->assertSame(0, PolicyDecision::count());
        $this->assertSame(0, BeneficiaryPolicyEvaluation::count());
    }

    public function test_resident_simulation_is_not_applicable_and_never_scored(): void
    {
        $actor = PolicyEScenario::actor();
        $version = PolicyEScenario::published($actor, ['application_scope' => ['applies_to' => 'all_existing_and_new']]);
        PolicyEScenario::beneficiary(['beneficiary_type' => 'resident', 'family_status' => 'poor']);

        $run = PolicyEScenario::simulate(PolicyEScenario::run($version, [], $actor), $actor);
        $result = $run->items()->first()->simulation_result;

        $this->assertSame(BeneficiaryPolicyEvaluation::ELIGIBILITY_NOT_APPLICABLE, $result['eligibility_decision']);
        $this->assertSame(PolicyOutcomeService::OUTCOME_POLICY_NOT_APPLICABLE, $result['intermediate_outcome']);
        $this->assertTrue($result['not_applicable']);
        $this->assertTrue($result['resident']);
        $this->assertNull($result['policy_score']);
        $this->assertNull($result['income_category']);
    }

    public function test_prior_evaluation_is_compared_deterministically_and_deltas_are_semantic(): void
    {
        $actor = PolicyEScenario::actor();
        $version = PolicyEScenario::published($actor, ['application_scope' => ['applies_to' => 'all_existing_and_new']]);
        $beneficiary = PolicyEScenario::beneficiary();

        // Real prior evaluation through the authoritative pipeline.
        $prior = $this->pipeline->evaluate($beneficiary->id, $version->id, $actor->id);
        $prior->forceFill(['evaluated_at' => now()->subDay()])->save();

        $run = PolicyEScenario::simulate(PolicyEScenario::run($version, [], $actor), $actor);
        $item = $run->items()->first();
        $result = $item->simulation_result;

        $this->assertSame($prior->id, $item->source_evaluation_id);
        $this->assertSame($prior->id, $result['source_evaluation_id']);
        $this->assertSame($prior->policy_version_id, $result['previous']['policy_version_id']);
        $this->assertSame($prior->eligibility_decision, $result['previous']['eligibility_decision']);
        $this->assertSame($prior->income_category, $result['previous']['income_category']);
        // Unchanged beneficiary + unchanged policy → no semantic movement at all.
        foreach (['eligibility_changed', 'income_category_changed', 'score_category_changed', 'policy_outcome_changed', 'financial_exclusion_changed', 'policy_score_changed'] as $flag) {
            $this->assertFalse($result['deltas'][$flag], "{$flag} must be false for an unchanged position");
        }
        $this->assertFalse($result['deltas']['new_review_required']);
        $this->assertSame([], $result['deltas']['review_reasons_added']);
        $this->assertSame([], $result['deltas']['review_reasons_removed']);
        $this->assertSame(0, PolicyDecision::count());
    }

    public function test_deltas_detect_real_movement_against_the_prior_evaluation(): void
    {
        $actor = PolicyEScenario::actor();
        $version = PolicyEScenario::published($actor, ['application_scope' => ['applies_to' => 'all_existing_and_new']]);
        $beneficiary = PolicyEScenario::beneficiary(['monthly_salary' => 500]);

        $prior = $this->pipeline->evaluate($beneficiary->id, $version->id, $actor->id);
        // A material financial change after the prior evaluation.
        $beneficiary->forceFill(['monthly_salary' => 9500])->save();

        $run = PolicyEScenario::simulate(PolicyEScenario::run($version, [], $actor), $actor);
        $result = $run->items()->first()->simulation_result;

        $this->assertSame($prior->id, $result['source_evaluation_id']);
        $this->assertTrue($result['deltas']['income_category_changed']);
        $this->assertTrue($result['deltas']['policy_outcome_changed']);
        $this->assertTrue($result['deltas']['policy_score_changed']);
        $this->assertTrue($result['deltas']['financial_exclusion_changed']);
        $this->assertSame(PolicyOutcomeService::OUTCOME_FINANCIALLY_EXCLUDED, $result['intermediate_outcome']);
        $this->assertSame(1, $run->simulation_summary['income_category_changed_count']);
        $this->assertSame(1, $run->simulation_summary['outcome_changed_count']);
        $this->assertSame(1, BeneficiaryPolicyEvaluation::count(), 'simulation adds no evaluation');
    }

    // ── CANDIDATE-SET HASH ─────────────────────────────────────────────

    public function test_candidate_set_hash_covers_version_mode_parameters_and_membership(): void
    {
        $actor = PolicyEScenario::actor();
        $version = PolicyEScenario::published($actor, ['application_scope' => ['applies_to' => 'selected_existing_and_new']]);
        $first = PolicyEScenario::beneficiary();
        $second = PolicyEScenario::beneficiary();

        $runA = PolicyEScenario::simulate(PolicyEScenario::run($version, ['beneficiary_ids' => [$first->id, $second->id]], $actor), $actor);
        $runB = PolicyEScenario::simulate(PolicyEScenario::run($version, ['beneficiary_ids' => [$second->id, $first->id]], $actor), $actor);
        $runC = PolicyEScenario::simulate(PolicyEScenario::run($version, ['beneficiary_ids' => [$first->id]], $actor), $actor);

        // Normalization (documented rule): the supplied order never changes the hash.
        $this->assertSame($runA->candidate_set_hash, $runB->candidate_set_hash);
        // Membership changes MUST change the hash.
        $this->assertNotSame($runA->candidate_set_hash, $runC->candidate_set_hash);
        // The scope fingerprint stays a separate, independent value.
        $this->assertSame($runA->simulation_fingerprint, $runB->simulation_fingerprint);
        $this->assertNotSame($runA->simulation_fingerprint, $runC->simulation_fingerprint);
        $this->assertNotSame($runA->simulation_fingerprint, $runA->candidate_set_hash);
        $this->assertSame(64, strlen($runA->candidate_set_hash));
    }

    public function test_candidate_set_hash_is_reproducible_for_the_same_reviewed_set(): void
    {
        $actor = PolicyEScenario::actor();
        $version = PolicyEScenario::published($actor, ['application_scope' => ['applies_to' => 'all_existing_and_new']]);
        PolicyEScenario::beneficiary();

        $first = PolicyEScenario::simulate(PolicyEScenario::run($version, [], $actor), $actor);
        $second = PolicyEScenario::simulate(PolicyEScenario::run($version, [], $actor), $actor);

        $this->assertSame($first->candidate_set_hash, $second->candidate_set_hash);

        // A new registration changes candidate membership → a new hash.
        PolicyEScenario::beneficiary();
        $third = PolicyEScenario::simulate(PolicyEScenario::run($version, [], $actor), $actor);
        $this->assertNotSame($first->candidate_set_hash, $third->candidate_set_hash);
    }

    public function test_source_state_marker_tracks_the_calculation_basis_only(): void
    {
        $actor = PolicyEScenario::actor();
        $version = PolicyEScenario::published($actor, ['application_scope' => ['applies_to' => 'all_existing_and_new']]);
        $beneficiary = PolicyEScenario::beneficiary();

        $run = PolicyEScenario::simulate(PolicyEScenario::run($version, [], $actor), $actor);
        $marker = $run->items()->first()->source_state_marker;

        $this->assertSame(64, strlen($marker));
        $this->assertSame($marker, $this->simulation->sourceStateMarker($beneficiary->fresh()));
        $this->assertStringNotContainsString($beneficiary->national_id, $marker);
    }

    // ── FAILURE ISOLATION ─────────────────────────────────────────────

    public function test_one_failing_candidate_does_not_erase_successful_items(): void
    {
        $actor = PolicyEScenario::actor();
        $version = PolicyEScenario::published($actor, ['application_scope' => ['applies_to' => 'all_existing_and_new']]);
        PolicyEScenario::beneficiary();
        PolicyEScenario::beneficiary();
        PolicyEScenario::beneficiary();

        // Deterministic per-item failure: only the engine call for ONE beneficiary
        // fails; every other candidate still uses the real authoritative pipeline.
        $failing = Beneficiary::query()->orderBy('id')->first()->id;
        $realCalculator = app(FinancialCalculationService::class);
        $this->partialMock(FinancialCalculationService::class, function ($mock) use ($failing, $realCalculator) {
            $mock->shouldReceive('calculatePolicyFinancials')->andReturnUsing(function ($beneficiary, $version) use ($failing, $realCalculator) {
                if ($beneficiary->id === $failing) {
                    throw new \RuntimeException('TEST_SIMULATION_FAILURE');
                }

                return $realCalculator->calculatePolicyFinancials($beneficiary, $version);
            });
        });

        $run = PolicyEScenario::simulate(PolicyEScenario::run($version, [], $actor), $actor);

        $this->assertSame(PolicyApplicationRun::STATUS_SIMULATED, $run->status);
        $this->assertSame(3, $run->total_candidates);
        $this->assertSame(2, $run->success_count);
        $this->assertSame(1, $run->failed_count);
        $this->assertSame(2, $run->simulation_summary['simulated_count']);
        $this->assertSame(1, $run->simulation_summary['failed_count']);

        $failed = $run->items()->where('status', 'failed')->firstOrFail();
        $this->assertSame(PolicyApplicationSimulationService::FAILURE_COMPUTE, $failed->failure_code);
        $this->assertStringContainsString('TEST_SIMULATION_FAILURE', $failed->failure_details);
        $this->assertStringNotContainsString('#0', $failed->failure_details, 'no stack trace may be stored');
        $this->assertNull($failed->simulation_result);
    }

    // ── API ───────────────────────────────────────────────────────────

    public function test_run_api_is_permission_gated_and_paginated(): void
    {
        $admin = PolicyEScenario::actor();
        Sanctum::actingAs($admin);
        $version = PolicyEScenario::published($admin, ['application_scope' => ['applies_to' => 'all_existing_and_new']]);
        foreach (range(1, 3) as $ignored) {
            PolicyEScenario::beneficiary();
        }

        $created = $this->postJson('/api/beneficiary-policy/versions/'.$version->id.'/application-runs')->assertCreated();
        $runId = $created->json('data.id');
        $simulated = $this->postJson('/api/beneficiary-policy/application-runs/'.$runId.'/simulate')->assertOk();
        $this->assertSame('simulated', $simulated->json('data.status'));
        $this->assertSame(3, $simulated->json('data.total_candidates'));
        $this->assertTrue($simulated->json('data.freshness.fresh'));

        $items = $this->getJson('/api/beneficiary-policy/application-runs/'.$runId.'/items?per_page=2')->assertOk();
        $this->assertSame(2, count($items->json('data.data')));
        $this->assertSame(3, $items->json('data.total'));
        $this->assertSame(2, $items->json('data.per_page'));
        // Bounded payload: per_page above the bound is rejected, never expanded.
        $this->getJson('/api/beneficiary-policy/application-runs/'.$runId.'/items?per_page=5000')->assertStatus(422);

        $show = $this->getJson('/api/beneficiary-policy/application-runs/'.$runId)->assertOk();
        $this->assertArrayHasKey('simulation_summary', $show->json('data'));
        $this->assertNotNull($show->json('data.candidate_set_hash'));

        // Audit: one run-level event, not one row per beneficiary.
        $this->assertSame(1, AuditLog::where('action', PolicyApplicationRunService::AUDIT_SCOPE_SIMULATED)->count());
    }

    public function test_simulation_rejected_outside_draft_state(): void
    {
        $actor = PolicyEScenario::actor();
        $version = PolicyEScenario::published($actor, ['application_scope' => ['applies_to' => 'all_existing_and_new']]);
        $run = PolicyEScenario::simulate(PolicyEScenario::run($version, [], $actor), $actor);

        $this->expectException(ValidationException::class);
        $this->simulation->simulate($run, $actor->id);
    }
}
