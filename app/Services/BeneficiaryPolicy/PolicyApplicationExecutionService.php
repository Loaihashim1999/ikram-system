<?php

namespace App\Services\BeneficiaryPolicy;

use App\Http\Exceptions\StableCodeException;
use App\Models\BeneficiaryPolicyEvaluation;
use App\Models\BeneficiaryPolicyVersion;
use App\Models\PolicyApplicationRun;
use App\Models\PolicyApplicationRunItem;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Throwable;

/**
 * POLICY-E3 — controlled, authorized re-evaluation execution.
 *
 * Execution is only reachable through the reviewed E2 simulation:
 *   simulated → (apply_scope) approved_for_execution → (execute_reevaluation) running
 *   → completed | completed_with_errors; failed items are the only retry input.
 *
 * Guarantees:
 * - staleness: the policy fingerprint, normalized scope parameters and the
 *   candidate-set hash are re-verified before approval and before execution, so
 *   a reviewed set can never silently drift;
 * - immutability: every processed beneficiary receives a NEW
 *   BeneficiaryPolicyEvaluation; prior evaluations and PolicyDecision history are
 *   never touched and no decision is carried forward (POLICY-D stays authoritative);
 * - idempotency: an item is executed exactly once (item state machine +
 *   unique(run_id, beneficiary_id)); completed items are never reprocessed;
 * - isolation: per-item transactions, bounded batches and sanitized failure
 *   records — committed successes survive a later item failure.
 */
final class PolicyApplicationExecutionService
{
    public const FAILURE_EXECUTION = 'EXECUTION_REEVALUATION_FAILED';

    /** Codes that may be retried: only genuine execution failures. */
    public const RETRYABLE_FAILURE_CODES = [self::FAILURE_EXECUTION];

    public const CONFLICT_NOT_APPROVED = 'RUN_NOT_APPROVED_FOR_EXECUTION';

    public const CONFLICT_NOT_SIMULATED = 'RUN_NOT_SIMULATED';

    public const CONFLICT_NOT_RETRYABLE = 'RUN_NOT_RETRYABLE';

    public const CONFLICT_NOT_CANCELLABLE = 'RUN_NOT_CANCELLABLE';

    public const CONFLICT_STALE = 'SIMULATION_STALE';

    public const CONFLICT_FINGERPRINT = 'SIMULATION_FINGERPRINT_MISMATCH';

    public const CONFLICT_SCOPE = 'SIMULATION_SCOPE_MISMATCH';

    public const CONFLICT_VERSION = 'POLICY_VERSION_NOT_PUBLISHED';

    public const CONFLICT_MISSING_SIMULATION = 'SIMULATION_MISSING';

    /** Item batch bound: per-item transactions, never one giant transaction. */
    public const BATCH = 50;

    public function __construct(
        private readonly PolicyFinancialEvaluationService $pipeline,
        private readonly PolicyApplicationRunService $runs,
        private readonly PolicyApplicationSimulationService $simulation,
        private readonly PolicyApplicationScopeService $scope,
    ) {}

    /**
     * POLICY-E3 apply authorization (beneficiary_policy:apply_scope): the
     * simulation is explicitly approved for application. A stale simulation is
     * rejected here too, so approval can never bless a drifted candidate set.
     */
    public function approveApplication(PolicyApplicationRun $run, string $actorId): PolicyApplicationRun
    {
        return DB::transaction(function () use ($run, $actorId) {
            $row = PolicyApplicationRun::lockForUpdate()->findOrFail($run->id);
            if ($row->status !== PolicyApplicationRun::STATUS_SIMULATED) {
                $this->conflict(self::CONFLICT_NOT_SIMULATED, 'الاعتماد متاح فقط لمحاكاة مكتملة (simulated).');
            }
            $this->assertFresh($row);

            return $this->runs->transition($row, PolicyApplicationRun::STATUS_APPROVED, $actorId);
        });
    }

    /**
     * Execute an approved run (beneficiary_policy:execute_reevaluation).
     */
    public function execute(PolicyApplicationRun $run, string $actorId): PolicyApplicationRun
    {
        $locked = $this->beginRunning($run, $actorId, self::CONFLICT_NOT_APPROVED);

        foreach (array_chunk($this->itemIdsFor($locked, [PolicyApplicationRunItem::STATUS_SIMULATED]), self::BATCH) as $batch) {
            foreach ($batch as $itemId) {
                $this->processItem($locked, $itemId, $actorId);
            }
            $this->syncCounters($locked);
        }

        return $this->finalize($locked, $actorId);
    }

    /**
     * Retry: re-enter `running` from `completed_with_errors` and reprocess ONLY
     * items that failed during execution. Successful items are never touched.
     */
    public function retry(PolicyApplicationRun $run, string $actorId): PolicyApplicationRun
    {
        $locked = DB::transaction(function () use ($run, $actorId) {
            $row = PolicyApplicationRun::lockForUpdate()->findOrFail($run->id);
            if ($row->status !== PolicyApplicationRun::STATUS_COMPLETED_WITH_ERRORS) {
                $this->conflict(self::CONFLICT_NOT_RETRYABLE, 'إعادة المحاولة متاحة فقط لتشغيل مكتمل بأخطاء.');
            }
            $this->assertFresh($row);

            $retryable = $row->items()
                ->where('status', PolicyApplicationRunItem::STATUS_FAILED)
                ->whereIn('failure_code', self::RETRYABLE_FAILURE_CODES)
                ->count();
            if ($retryable === 0) {
                $this->conflict(self::CONFLICT_NOT_RETRYABLE, 'لا توجد عناصر فاشلة قابلة لإعادة المحاولة في هذا التشغيل.');
            }

            return $this->runs->transition($row, PolicyApplicationRun::STATUS_RUNNING, $actorId);
        });

        foreach (array_chunk($this->itemIdsFor($locked, [PolicyApplicationRunItem::STATUS_FAILED], self::RETRYABLE_FAILURE_CODES), self::BATCH) as $batch) {
            foreach ($batch as $itemId) {
                $this->processItem($locked, $itemId, $actorId);
            }
            $this->syncCounters($locked);
        }

        return $this->finalize($locked, $actorId);
    }

    /**
     * Cancel unprocessed work. Completed immutable evaluations are history and
     * are never deleted or rolled back.
     */
    public function cancel(PolicyApplicationRun $run, string $actorId): PolicyApplicationRun
    {
        return DB::transaction(function () use ($run, $actorId) {
            $row = PolicyApplicationRun::lockForUpdate()->findOrFail($run->id);
            if (! in_array($row->status, PolicyApplicationRun::CANCELLABLE, true)) {
                $this->conflict(self::CONFLICT_NOT_CANCELLABLE, 'لا يمكن إلغاء التشغيل من حالته الحالية.');
            }
            foreach ($row->items()
                ->whereIn('status', [PolicyApplicationRunItem::STATUS_PENDING, PolicyApplicationRunItem::STATUS_SIMULATED])
                ->get() as $item) {
                $item->transitionTo(PolicyApplicationRunItem::STATUS_CANCELLED);
            }

            return $this->runs->transition($row, PolicyApplicationRun::STATUS_CANCELLED, $actorId);
        });
    }

    /**
     * Diagnostic read for the API/UI: deterministic verification of a run's
     * simulation basis without mutating anything.
     */
    public function verifyFreshness(PolicyApplicationRun $run): array
    {
        try {
            $version = BeneficiaryPolicyVersion::findOrFail($run->policy_version_id);
            if (! $version->isPublished()) {
                return ['fresh' => false, 'code' => self::CONFLICT_VERSION];
            }
            if (! is_string($run->candidate_set_hash) || $run->candidate_set_hash === '') {
                return ['fresh' => false, 'code' => self::CONFLICT_MISSING_SIMULATION];
            }
            if ($run->simulation_fingerprint !== $this->scope->fingerprint($version->id, $run->scope_mode, $run->scope_parameters ?? [])) {
                return ['fresh' => false, 'code' => self::CONFLICT_FINGERPRINT];
            }
            if ($run->candidate_set_hash !== $this->currentCandidateHash($run, $version)) {
                return ['fresh' => false, 'code' => self::CONFLICT_STALE];
            }

            return ['fresh' => true, 'code' => 'FRESH'];
        } catch (StableCodeException $e) {
            return ['fresh' => false, 'code' => $e->stableCode];
        }
    }

    private function conflict(string $code, string $message): never
    {
        throw new StableCodeException($code, $message, 409);
    }

    private function beginRunning(PolicyApplicationRun $run, string $actorId, string $requiredCode): PolicyApplicationRun
    {
        return DB::transaction(function () use ($run, $actorId, $requiredCode) {
            $row = PolicyApplicationRun::lockForUpdate()->findOrFail($run->id);
            if ($row->status !== PolicyApplicationRun::STATUS_APPROVED) {
                $this->conflict($requiredCode, 'التنفيذ متاح فقط لتشغيل معتمد للتطبيق (approved_for_execution).');
            }
            $this->assertFresh($row);

            return $this->runs->transition($row, PolicyApplicationRun::STATUS_RUNNING, $actorId);
        });
    }

    /**
     * Execution-time staleness protection: policy version, fingerprint,
     * normalized scope parameters and the freshly re-enumerated candidate set
     * must all match the reviewed simulation.
     */
    private function assertFresh(PolicyApplicationRun $run): void
    {
        $freshness = $this->verifyFreshness($run);
        if ($freshness['fresh'] === true) {
            return;
        }

        $message = match ($freshness['code']) {
            self::CONFLICT_VERSION => 'إصدار السياسة لم يعد منشوراً؛ لا يمكن تنفيذ المحاكاة.',
            self::CONFLICT_MISSING_SIMULATION => 'لا توجد محاكاة مسجلة لهذا التشغيل.',
            self::CONFLICT_FINGERPRINT => 'بصمة نطاق التطبيق تغيّرت عن المحاكاة المعتمدة.',
            default => 'محاكاة قديمة: تغيّرت مجموعة المرشحين أو أسس الاحتساب؛ يلزم إجراء محاكاة جديدة قبل التنفيذ.',
        };
        $this->conflict($freshness['code'], $message);
    }

    private function currentCandidateHash(PolicyApplicationRun $run, BeneficiaryPolicyVersion $version): string
    {
        $normalized = $this->scope->validateAndNormalize($run->scope_mode, $run->scope_parameters ?? [], $version);
        if ($normalized != ($run->scope_parameters ?? [])) {
            $this->conflict(self::CONFLICT_SCOPE, 'مُعاملات نطاق التطبيق تغيّرت عن المحاكاة المعتمدة.');
        }

        return $this->simulation->candidateSetHash(
            $version->id,
            $run->scope_mode,
            $normalized,
            $this->simulation->candidateIds($run)
        );
    }

    private function itemIdsFor(PolicyApplicationRun $run, array $statuses, array $failureCodes = []): array
    {
        return $run->items()
            ->whereIn('status', $statuses)
            ->when($failureCodes !== [], fn ($q) => $q->whereIn('failure_code', $failureCodes))
            ->orderBy('id')
            ->pluck('id')
            ->all();
    }

    /**
     * One beneficiary, one short transaction. The item row is locked so two
     * executors can never create two evaluations for the same run item, and a
     * committed success stays committed if a later item fails.
     */
    private function processItem(PolicyApplicationRun $run, string $itemId, string $actorId): void
    {
        DB::transaction(function () use ($run, $itemId, $actorId) {
            $item = PolicyApplicationRunItem::whereKey($itemId)->lockForUpdate()->first();
            if (! $item) {
                return;
            }
            // Idempotency guard: only an unreviewed simulated item may execute,
            // or a retryable failed item during an explicit retry. Completed /
            // review_required / not_applicable / cancelled items are never redone.
            $executable = $item->status === PolicyApplicationRunItem::STATUS_SIMULATED
                || ($item->status === PolicyApplicationRunItem::STATUS_FAILED
                    && in_array($item->failure_code, self::RETRYABLE_FAILURE_CODES, true));
            if (! $executable) {
                return;
            }

            $item->transitionTo(PolicyApplicationRunItem::STATUS_PROCESSING);

            try {
                // Authoritative pipeline: creates a NEW immutable evaluation.
                // Prior evaluations and PolicyDecision history stay untouched, and
                // POLICY-D evidence is evaluation-scoped, so the new evaluation
                // starts its own review lifecycle (no inherited decision).
                $evaluation = $this->pipeline->evaluate($item->beneficiary_id, $run->policy_version_id, $actorId);
                $item->forceFill([
                    'new_evaluation_id' => $evaluation->id,
                    'failure_code' => null,
                    'failure_details' => null,
                ])->save();
                $item->transitionTo($this->terminalStatus($evaluation));
            } catch (Throwable $e) {
                $item->forceFill([
                    'failure_code' => self::FAILURE_EXECUTION,
                    'failure_details' => Str::limit(trim(preg_replace('/\s+/', ' ', class_basename($e).': '.$e->getMessage())), 300),
                ])->save();
                $item->transitionTo(PolicyApplicationRunItem::STATUS_FAILED);
            }
        });
    }

    private function terminalStatus(BeneficiaryPolicyEvaluation $evaluation): string
    {
        if ($evaluation->eligibility_decision === BeneficiaryPolicyEvaluation::ELIGIBILITY_NOT_APPLICABLE) {
            return PolicyApplicationRunItem::STATUS_NOT_APPLICABLE;
        }
        $outcome = $evaluation->scoring_snapshot['outcome'] ?? null;
        if ($evaluation->eligibility_decision === BeneficiaryPolicyEvaluation::ELIGIBILITY_REVIEW_REQUIRED
            || in_array($outcome, [
                PolicyOutcomeService::OUTCOME_POLICY_REVIEW_REQUIRED,
                PolicyOutcomeService::OUTCOME_EXCEPTION_REVIEW_REQUIRED,
            ], true)) {
            return PolicyApplicationRunItem::STATUS_REVIEW_REQUIRED;
        }

        return PolicyApplicationRunItem::STATUS_COMPLETED;
    }

    /**
     * Progress counters are derived from the ledger inside one atomic UPDATE, so
     * they always stay consistent with the run items.
     */
    private function syncCounters(PolicyApplicationRun $run): PolicyApplicationRun
    {
        $counts = $run->items()
            ->selectRaw('status, count(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status');

        $success = (int) ($counts[PolicyApplicationRunItem::STATUS_COMPLETED] ?? 0);
        $review = (int) ($counts[PolicyApplicationRunItem::STATUS_REVIEW_REQUIRED] ?? 0);
        $notApplicable = (int) ($counts[PolicyApplicationRunItem::STATUS_NOT_APPLICABLE] ?? 0);
        $failed = (int) ($counts[PolicyApplicationRunItem::STATUS_FAILED] ?? 0);

        PolicyApplicationRun::whereKey($run->id)->update([
            'processed_count' => $success + $review + $notApplicable + $failed,
            'success_count' => $success,
            'review_count' => $review,
            'not_applicable_count' => $notApplicable,
            'failed_count' => $failed,
        ]);

        return $run->refresh();
    }

    private function finalize(PolicyApplicationRun $run, string $actorId): PolicyApplicationRun
    {
        return DB::transaction(function () use ($run, $actorId) {
            $row = PolicyApplicationRun::lockForUpdate()->findOrFail($run->id);
            if ($row->status !== PolicyApplicationRun::STATUS_RUNNING) {
                // Cancelled/failed underneath us: never override that decision.
                return $row;
            }
            $row = $this->syncCounters($row);
            $target = $row->failed_count > 0
                ? PolicyApplicationRun::STATUS_COMPLETED_WITH_ERRORS
                : PolicyApplicationRun::STATUS_COMPLETED;

            return $this->runs->transition($row, $target, $actorId);
        });
    }
}
