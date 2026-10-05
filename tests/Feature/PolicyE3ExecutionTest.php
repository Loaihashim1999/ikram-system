<?php

namespace Tests\Feature;

use App\Http\Exceptions\StableCodeException;
use App\Models\AuditLog;
use App\Models\Beneficiary;
use App\Models\BeneficiaryPolicyEvaluation;
use App\Models\PolicyApplicationRun;
use App\Models\PolicyApplicationRunItem;
use App\Models\PolicyDecision;
use App\Services\BeneficiaryPolicy\PolicyApplicationExecutionService;
use App\Services\BeneficiaryPolicy\PolicyApplicationRunService;
use App\Services\BeneficiaryPolicy\PolicyFinancialEvaluationService;
use App\Services\FinancialCalculationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Support\PolicyEScenario;
use Tests\TestCase;

/**
 * POLICY-E3 — controlled execution, idempotency, failure isolation, retry,
 * cancellation and staleness rejection.
 *
 * Every assertion runs through the real services/routes: evaluations are created
 * by the authoritative pipeline, prior history is compared byte-for-byte and no
 * POLICY-D decision is ever produced by execution.
 */
class PolicyE3ExecutionTest extends TestCase
{
    use RefreshDatabase;

    protected PolicyApplicationExecutionService $execution;

    protected PolicyApplicationRunService $runs;

    protected PolicyFinancialEvaluationService $pipeline;

    protected function setUp(): void
    {
        parent::setUp();
        $this->execution = app(PolicyApplicationExecutionService::class);
        $this->runs = app(PolicyApplicationRunService::class);
        $this->pipeline = app(PolicyFinancialEvaluationService::class);
        Sanctum::actingAs(PolicyEScenario::actor());
    }

    /** A simulated + approved run for the given number of existing beneficiaries. */
    protected function approvedRun(int $candidates = 1): array
    {
        $actor = PolicyEScenario::actor();
        $version = PolicyEScenario::published($actor, ['application_scope' => ['applies_to' => 'all_existing_and_new']]);
        foreach (range(1, $candidates) as $ignored) {
            PolicyEScenario::beneficiary();
        }
        $run = PolicyEScenario::simulate(PolicyEScenario::run($version, [], $actor), $actor);

        return [$actor, $version, $this->execution->approveApplication($run, $actor->id)];
    }

    protected function conflict(callable $action): StableCodeException
    {
        try {
            $action();
        } catch (StableCodeException $e) {
            return $e;
        }
        $this->fail('expected a controlled conflict with a stable code');
    }

    protected function assertCounterConsistency(PolicyApplicationRun $run): void
    {
        $counts = $run->items()->selectRaw('status, count(*) as total')->groupBy('status')->pluck('total', 'status');
        $this->assertSame((int) ($counts[PolicyApplicationRunItem::STATUS_COMPLETED] ?? 0), $run->success_count);
        $this->assertSame((int) ($counts[PolicyApplicationRunItem::STATUS_REVIEW_REQUIRED] ?? 0), $run->review_count);
        $this->assertSame((int) ($counts[PolicyApplicationRunItem::STATUS_NOT_APPLICABLE] ?? 0), $run->not_applicable_count);
        $this->assertSame((int) ($counts[PolicyApplicationRunItem::STATUS_FAILED] ?? 0), $run->failed_count);
        $this->assertSame(
            $run->success_count + $run->review_count + $run->not_applicable_count + $run->failed_count,
            $run->processed_count
        );
    }

    // ── PREREQUISITES ─────────────────────────────────────────────────

    public function test_execution_requires_a_prior_simulation_and_authorization(): void
    {
        $actor = PolicyEScenario::actor();
        $version = PolicyEScenario::published($actor, ['application_scope' => ['applies_to' => 'all_existing_and_new']]);
        PolicyEScenario::beneficiary();
        $draft = PolicyEScenario::run($version, [], $actor);

        // No simulation yet.
        $this->assertSame(
            PolicyApplicationExecutionService::CONFLICT_NOT_APPROVED,
            $this->conflict(fn () => $this->execution->execute($draft, $actor->id))->stableCode
        );
        $this->assertSame(0, BeneficiaryPolicyEvaluation::count());

        // Simulated but not approved.
        $simulated = PolicyEScenario::simulate($draft, $actor);
        $this->assertSame(
            PolicyApplicationExecutionService::CONFLICT_NOT_APPROVED,
            $this->conflict(fn () => $this->execution->execute($simulated, $actor->id))->stableCode
        );
        $this->assertSame(0, BeneficiaryPolicyEvaluation::count());
        $this->assertSame(PolicyApplicationRun::STATUS_SIMULATED, $simulated->fresh()->status);

        // Approval is only valid from `simulated` (never from draft).
        $this->assertSame(
            PolicyApplicationExecutionService::CONFLICT_NOT_SIMULATED,
            $this->conflict(fn () => $this->execution->approveApplication(PolicyEScenario::run($version, [], $actor), $actor->id))->stableCode
        );
    }

    // ── EXECUTION CONTRACT ────────────────────────────────────────────

    public function test_execution_creates_new_immutable_evaluation_and_preserves_history(): void
    {
        $actor = PolicyEScenario::actor();
        $version = PolicyEScenario::published($actor, ['application_scope' => ['applies_to' => 'all_existing_and_new']]);
        $beneficiary = PolicyEScenario::beneficiary();
        PolicyEScenario::beneficiary(['beneficiary_type' => 'resident', 'family_status' => 'poor']);

        // Historical position: an evaluation AND an explicit POLICY-D decision.
        $prior = $this->pipeline->evaluate($beneficiary->id, $version->id, $actor->id);
        $decision = PolicyDecision::create([
            'evaluation_id' => $prior->id,
            'policy_version_id' => $version->id,
            'decision' => 'approved',
            'decided_by' => $actor->id,
            'decided_at' => now(),
            'stable_reason_code' => 'POLICY_TEST',
            'human_readable_reason' => 'اختبار حفظ السجل التاريخي',
        ]);
        $priorBefore = BeneficiaryPolicyEvaluation::findOrFail($prior->id)->toArray();
        $decisionBefore = PolicyDecision::findOrFail($decision->id)->toArray();

        $run = PolicyEScenario::simulate(PolicyEScenario::run($version, [], $actor), $actor);
        $this->execution->approveApplication($run, $actor->id);
        $completed = $this->execution->execute($run, $actor->id);

        $this->assertSame(PolicyApplicationRun::STATUS_COMPLETED, $completed->status);
        $this->assertEquals($priorBefore, BeneficiaryPolicyEvaluation::findOrFail($prior->id)->toArray(), 'prior evaluation is immutable');
        $this->assertEquals($decisionBefore, PolicyDecision::findOrFail($decision->id)->toArray(), 'prior decision is immutable');
        $this->assertSame(1, PolicyDecision::count(), 'execution never creates a decision');

        // Prior row + one NEW evaluation per processed candidate: the citizen's
        // re-evaluation and the resident's recorded not_applicable outcome.
        $this->assertSame(3, BeneficiaryPolicyEvaluation::count());
        $item = $completed->items()->where('beneficiary_id', $beneficiary->id)->firstOrFail();
        $this->assertNotNull($item->new_evaluation_id);
        $this->assertNotSame($prior->id, $item->new_evaluation_id);
        $this->assertContains($item->status, [PolicyApplicationRunItem::STATUS_COMPLETED, PolicyApplicationRunItem::STATUS_REVIEW_REQUIRED], true);
        $newEvaluation = BeneficiaryPolicyEvaluation::findOrFail($item->new_evaluation_id);
        $this->assertNull($newEvaluation->final_policy_decision, 'the new evaluation starts its own POLICY-D lifecycle');
        $this->assertSame($prior->id, $item->source_evaluation_id);

        $residentItem = $completed->items()->where('beneficiary_id', '!=', $beneficiary->id)->firstOrFail();
        $this->assertSame(PolicyApplicationRunItem::STATUS_NOT_APPLICABLE, $residentItem->status);
        $this->assertNotNull($residentItem->new_evaluation_id);

        $this->assertCounterConsistency($completed->fresh());
        $this->assertNotNull(AuditLog::where('action', PolicyApplicationRunService::AUDIT_RUN_STARTED)->first());
        $this->assertNotNull(AuditLog::where('action', PolicyApplicationRunService::AUDIT_RUN_COMPLETED)->first());
    }

    public function test_execution_is_idempotent_and_never_duplicates_evaluations(): void
    {
        [$actor, $version, $approved] = $this->approvedRun(2);
        $completed = $this->execution->execute($approved, $actor->id);
        $evaluationsAfterFirst = BeneficiaryPolicyEvaluation::count();
        $this->assertSame(2, $evaluationsAfterFirst);

        // A second execution attempt is a controlled conflict, not a re-run.
        $this->assertSame(
            PolicyApplicationExecutionService::CONFLICT_NOT_APPROVED,
            $this->conflict(fn () => $this->execution->execute($completed, $actor->id))->stableCode
        );
        $this->assertSame($evaluationsAfterFirst, BeneficiaryPolicyEvaluation::count());
        $this->assertSame(2, $completed->items()->whereNotNull('new_evaluation_id')->count());
        $this->assertSame(0, $completed->failed_count);
    }

    // ── STALENESS ─────────────────────────────────────────────────────

    public function test_stale_simulation_is_rejected_before_approval_and_execution(): void
    {
        $actor = PolicyEScenario::actor();
        $version = PolicyEScenario::published($actor, ['application_scope' => ['applies_to' => 'all_existing_and_new']]);
        PolicyEScenario::beneficiary();
        $run = PolicyEScenario::simulate(PolicyEScenario::run($version, [], $actor), $actor);

        // Candidate membership changes after the reviewed simulation.
        PolicyEScenario::beneficiary();

        $this->assertSame(
            PolicyApplicationExecutionService::CONFLICT_STALE,
            $this->conflict(fn () => $this->execution->approveApplication($run, $actor->id))->stableCode
        );
        $this->assertSame(PolicyApplicationRun::STATUS_SIMULATED, $run->fresh()->status, 'a stale simulation is never approved');
        $this->assertFalse($this->execution->verifyFreshness($run)['fresh']);
        $this->assertSame(0, BeneficiaryPolicyEvaluation::count());

        // The same protection holds at execution time: approve on a fresh basis,
        // then drift the candidate set again.
        $fresh = PolicyEScenario::simulate(PolicyEScenario::run($version, [], $actor), $actor);
        $this->execution->approveApplication($fresh, $actor->id);
        PolicyEScenario::beneficiary();
        $this->assertSame(
            PolicyApplicationExecutionService::CONFLICT_STALE,
            $this->conflict(fn () => $this->execution->execute($fresh, $actor->id))->stableCode
        );
        $this->assertSame(0, BeneficiaryPolicyEvaluation::count());
    }

    public function test_unpublished_policy_version_blocks_execution(): void
    {
        [$actor, $version, $approved] = $this->approvedRun(1);
        $version->forceFill(['status' => 'retired'])->save();

        $this->assertSame(
            PolicyApplicationExecutionService::CONFLICT_VERSION,
            $this->conflict(fn () => $this->execution->execute($approved, $actor->id))->stableCode
        );
        $this->assertSame(0, BeneficiaryPolicyEvaluation::count());
    }

    // ── FAILURE ISOLATION & RETRY ─────────────────────────────────────

    public function test_partial_failure_isolates_successes_and_retry_only_reprocesses_failures(): void
    {
        $actor = PolicyEScenario::actor();
        $version = PolicyEScenario::published($actor, ['application_scope' => ['applies_to' => 'all_existing_and_new']]);
        PolicyEScenario::beneficiary();
        $second = PolicyEScenario::beneficiary();
        $run = PolicyEScenario::simulate(PolicyEScenario::run($version, [], $actor), $actor);

        // One transient execution failure for a single beneficiary.
        $failFor = $second->id;
        $realCalculator = app(FinancialCalculationService::class);
        $state = new \stdClass;
        $state->failOnce = true;
        $this->partialMock(FinancialCalculationService::class, function ($mock) use ($failFor, $realCalculator, $state) {
            $mock->shouldReceive('calculatePolicyFinancials')->andReturnUsing(function ($beneficiary, $version) use ($failFor, $realCalculator, $state) {
                if ($beneficiary->id === $failFor && $state->failOnce) {
                    $state->failOnce = false;

                    throw new \RuntimeException('TEST_EXECUTION_FAILURE');
                }

                return $realCalculator->calculatePolicyFinancials($beneficiary, $version);
            });
        });

        $execution = app(PolicyApplicationExecutionService::class);
        $execution->approveApplication($run, $actor->id);
        $completed = $execution->execute($run, $actor->id);

        $this->assertSame(PolicyApplicationRun::STATUS_COMPLETED_WITH_ERRORS, $completed->status);
        $this->assertSame(1, $completed->failed_count);
        $this->assertSame(2, $completed->processed_count, 'both candidates were processed (one committed, one failed)');
        $this->assertSame(1, BeneficiaryPolicyEvaluation::count(), 'the successful item stays committed');
        $this->assertCounterConsistency($completed->fresh());
        $this->assertNotNull(AuditLog::where('action', PolicyApplicationRunService::AUDIT_RUN_COMPLETED_WITH_ERRORS)->first());

        // Retry: only the failed item is reprocessed; the success is untouched.
        $failed = $completed->items()->where('status', PolicyApplicationRunItem::STATUS_FAILED)->firstOrFail();
        $successful = $completed->items()->where('status', '!=', PolicyApplicationRunItem::STATUS_FAILED)->firstOrFail();
        $successfulEvaluation = $successful->new_evaluation_id;
        $this->assertSame(PolicyApplicationExecutionService::FAILURE_EXECUTION, $failed->failure_code);
        $this->assertStringContainsString('TEST_EXECUTION_FAILURE', $failed->failure_details);
        $this->assertStringNotContainsString('#0', $failed->failure_details, 'failure details stay sanitized');
        $this->assertSame(1, $failed->attempt_count);

        $retried = $execution->retry($completed, $actor->id);
        $this->assertSame(PolicyApplicationRun::STATUS_COMPLETED, $retried->status);
        $this->assertSame(0, $retried->failed_count);
        $this->assertSame(2, BeneficiaryPolicyEvaluation::count(), 'exactly one new evaluation per beneficiary');
        $this->assertSame($successfulEvaluation, $successful->fresh()->new_evaluation_id, 'successful item is not duplicated');
        $this->assertNotNull($failed->fresh()->new_evaluation_id);
        $this->assertSame(2, $failed->fresh()->attempt_count);
        $this->assertCounterConsistency($retried->fresh());
    }

    public function test_retry_rejected_when_nothing_is_retryable(): void
    {
        [$actor, $version, $approved] = $this->approvedRun(1);
        $completed = $this->execution->execute($approved, $actor->id);

        $this->assertSame(
            PolicyApplicationExecutionService::CONFLICT_NOT_RETRYABLE,
            $this->conflict(fn () => $this->execution->retry($completed, $actor->id))->stableCode
        );
        $this->assertSame(
            PolicyApplicationExecutionService::CONFLICT_NOT_RETRYABLE,
            $this->conflict(fn () => $this->execution->retry($approved, $actor->id))->stableCode
        );
        $this->assertSame(1, BeneficiaryPolicyEvaluation::count());
    }

    // ── CANCELLATION ──────────────────────────────────────────────────

    public function test_cancellation_cancels_unprocessed_items_and_keeps_history(): void
    {
        // One published version, two reviewed runs: a second publish is rejected
        // while another version of the same scope keeps an open published period.
        $actor = PolicyEScenario::actor();
        $version = PolicyEScenario::published($actor, ['application_scope' => ['applies_to' => 'all_existing_and_new']]);
        PolicyEScenario::beneficiary();
        PolicyEScenario::beneficiary();
        $first = PolicyEScenario::simulate(PolicyEScenario::run($version, [], $actor), $actor);
        $second = PolicyEScenario::simulate(PolicyEScenario::run($version, [], $actor), $actor);
        $approvedFirst = $this->execution->approveApplication($first, $actor->id);
        $approvedSecond = $this->execution->approveApplication($second, $actor->id);

        $cancelled = $this->execution->cancel($approvedFirst, $actor->id);

        $this->assertSame(PolicyApplicationRun::STATUS_CANCELLED, $cancelled->status);
        $this->assertSame(2, $cancelled->items()->where('status', PolicyApplicationRunItem::STATUS_CANCELLED)->count());
        $this->assertSame(0, BeneficiaryPolicyEvaluation::count(), 'cancellation never creates evaluations');
        $this->assertNotNull(AuditLog::where('action', PolicyApplicationRunService::AUDIT_RUN_CANCELLED)->first());

        // A cancelled run is terminal: re-cancellation conflicts.
        $this->assertSame(
            PolicyApplicationExecutionService::CONFLICT_NOT_CANCELLABLE,
            $this->conflict(fn () => $this->execution->cancel($cancelled, $actor->id))->stableCode
        );

        // Completed evaluations are immutable history: never cancellable.
        $completed = $this->execution->execute($approvedSecond, $actor->id);
        $this->assertSame(2, BeneficiaryPolicyEvaluation::count());
        $this->assertSame(
            PolicyApplicationExecutionService::CONFLICT_NOT_CANCELLABLE,
            $this->conflict(fn () => $this->execution->cancel($completed, $actor->id))->stableCode
        );
        $this->assertSame(2, BeneficiaryPolicyEvaluation::count(), 'a rejected cancellation deletes nothing');
    }

    // ── API PERMISSIONS ───────────────────────────────────────────────

    public function test_execution_api_separates_apply_and_execute_permissions(): void
    {
        $admin = PolicyEScenario::actor();
        $version = PolicyEScenario::published($admin, ['application_scope' => ['applies_to' => 'all_existing_and_new']]);
        PolicyEScenario::beneficiary();
        $run = PolicyEScenario::simulate(PolicyEScenario::run($version, [], $admin), $admin);
        $url = '/api/beneficiary-policy/application-runs/'.$run->id;

        // Simulate/view-only: may neither approve nor execute.
        Sanctum::actingAs(PolicyEScenario::actor(['simulate', 'view_application_runs'], 'assistant_admin'));
        $this->postJson($url.'/approve-application')->assertForbidden();
        $this->postJson($url.'/execute')->assertForbidden();

        // apply_scope may approve but never execute.
        Sanctum::actingAs(PolicyEScenario::actor(['apply_scope'], 'assistant_admin'));
        $this->postJson($url.'/execute')->assertForbidden();
        $approved = $this->postJson($url.'/approve-application')->assertOk();
        $this->assertSame(PolicyApplicationRun::STATUS_APPROVED, $approved->json('data.status'));

        // execute_reevaluation executes the approved run.
        Sanctum::actingAs(PolicyEScenario::actor(['execute_reevaluation'], 'assistant_admin'));
        $done = $this->postJson($url.'/execute')->assertOk();
        $this->assertSame(PolicyApplicationRun::STATUS_COMPLETED, $done->json('data.status'));
        $this->assertSame(1, BeneficiaryPolicyEvaluation::count());
    }

    // ── STALENESS OVER HTTP ───────────────────────────────────────────

    public function test_stale_execution_over_http_returns_409_with_stable_code(): void
    {
        $version = PolicyEScenario::published($admin = PolicyEScenario::actor(), ['application_scope' => ['applies_to' => 'all_existing_and_new']]);
        PolicyEScenario::beneficiary();
        $created = $this->postJson('/api/beneficiary-policy/versions/'.$version->id.'/application-runs')->assertCreated();
        $runId = $created->json('data.id');
        $this->postJson('/api/beneficiary-policy/application-runs/'.$runId.'/simulate')->assertOk();
        $this->postJson('/api/beneficiary-policy/application-runs/'.$runId.'/approve-application')->assertOk();

        // The reviewed candidate set drifts after approval.
        PolicyEScenario::beneficiary();

        $stale = $this->postJson('/api/beneficiary-policy/application-runs/'.$runId.'/execute');
        $stale->assertStatus(409);
        $this->assertFalse($stale->json('success'));
        $this->assertSame(PolicyApplicationExecutionService::CONFLICT_STALE, $stale->json('code'));

        // Nothing executed and the approval was not overridden.
        $this->assertSame(PolicyApplicationRun::STATUS_APPROVED, PolicyApplicationRun::findOrFail($runId)->status);
        $this->assertSame(0, BeneficiaryPolicyEvaluation::count());
    }
}
