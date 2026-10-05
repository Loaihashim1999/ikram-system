<?php

namespace App\Services\BeneficiaryPolicy;

use App\Models\AuditLog;
use App\Models\BeneficiaryPolicyVersion;
use App\Models\PolicyApplicationRun;
use App\Models\PolicyApplicationRunItem;
use Illuminate\Validation\ValidationException;

/**
 * POLICY-E1 — application-scope run ledger foundation.
 *
 * Creates runs and drives the run state machine. It performs NO simulation
 * (POLICY-E2), NO execution/retry (POLICY-E3) and NO registration hooks
 * (POLICY-E4). A configuration default scope is NEVER execution authorization:
 * existing beneficiaries are only processed after simulation + explicit
 * authorized execution in later POLICY-E stages.
 */
class PolicyApplicationRunService
{
    /** Audit action contract (POLICY-E lifecycle events; fired only when the
     *  corresponding action really occurs through this service). */
    public const AUDIT_SCOPE_SIMULATED = 'POLICY_SCOPE_SIMULATED';

    public const AUDIT_RUN_CREATED = 'POLICY_APPLICATION_RUN_CREATED';

    public const AUDIT_RUN_STARTED = 'POLICY_APPLICATION_RUN_STARTED';

    public const AUDIT_RUN_APPROVED = 'POLICY_APPLICATION_RUN_APPROVED_FOR_EXECUTION';

    public const AUDIT_RUN_FAILED = 'POLICY_APPLICATION_RUN_FAILED';

    public const AUDIT_RUN_COMPLETED = 'POLICY_APPLICATION_RUN_COMPLETED';

    public const AUDIT_RUN_COMPLETED_WITH_ERRORS = 'POLICY_APPLICATION_RUN_COMPLETED_WITH_ERRORS';

    public const AUDIT_RUN_CANCELLED = 'POLICY_APPLICATION_RUN_CANCELLED';

    public function __construct(private readonly PolicyApplicationScopeService $scope) {}

    /**
     * Create a run ledger entry for a PUBLISHED policy version. The scope mode
     * is read from the immutable published configuration; run-level parameters
     * are validated/normalized and fingerprinted.
     *
     * @throws ValidationException
     */
    public function create(BeneficiaryPolicyVersion $version, array $scopeParameters, string $requestedBy): PolicyApplicationRun
    {
        if (! $version->isPublished()) {
            throw ValidationException::withMessages([
                'policy_version' => 'لا يمكن إنشاء تشغيل نطاق تطبيق إلا على إصدار منشور.',
            ]);
        }

        $mode = $this->scope->modeFor($version);
        $normalized = $this->scope->validateAndNormalize($mode, $scopeParameters, $version);

        $run = PolicyApplicationRun::create([
            'policy_version_id' => $version->id,
            'scope_mode' => $mode,
            'scope_parameters' => $normalized,
            'status' => PolicyApplicationRun::STATUS_DRAFT,
            'simulation_fingerprint' => $this->scope->fingerprint($version->id, $mode, $normalized),
            'requested_by' => $requestedBy,
        ]);

        $this->audit(self::AUDIT_RUN_CREATED, $run, $requestedBy);

        return $run;
    }

    /**
     * Register a beneficiary candidate into a DRAFT run (candidate capture for
     * the later simulation). Uniqueness is backstopped by the database
     * (unique run_id + beneficiary_id); this pre-check gives a clean error.
     *
     * @throws ValidationException
     */
    public function addItem(PolicyApplicationRun $run, string $beneficiaryId, ?string $sourceEvaluationId = null): PolicyApplicationRunItem
    {
        if ($run->status !== PolicyApplicationRun::STATUS_DRAFT) {
            throw ValidationException::withMessages([
                'run' => 'لا يمكن إضافة مرشحين إلا أثناء حالة المسودة (draft).',
            ]);
        }
        if ($run->items()->where('beneficiary_id', $beneficiaryId)->exists()) {
            throw ValidationException::withMessages([
                'beneficiary_id' => 'المستفيد مُضاف مسبقاً إلى هذا التشغيل.',
            ]);
        }

        return $run->items()->create([
            'beneficiary_id' => $beneficiaryId,
            'status' => PolicyApplicationRunItem::STATUS_PENDING,
            'source_evaluation_id' => $sourceEvaluationId,
        ]);
    }

    /**
     * Drive the guarded run state machine and audit the lifecycle events that
     * really occur. Illegal transitions throw ValidationException.
     *
     * @throws ValidationException
     */
    public function transition(PolicyApplicationRun $run, string $to, ?string $actorId = null): PolicyApplicationRun
    {
        $from = $run->status;
        $run->transitionTo($to, $actorId);

        $event = match ($to) {
            PolicyApplicationRun::STATUS_SIMULATED => self::AUDIT_SCOPE_SIMULATED,
            PolicyApplicationRun::STATUS_APPROVED => self::AUDIT_RUN_APPROVED,
            PolicyApplicationRun::STATUS_RUNNING => self::AUDIT_RUN_STARTED,
            PolicyApplicationRun::STATUS_COMPLETED => self::AUDIT_RUN_COMPLETED,
            PolicyApplicationRun::STATUS_COMPLETED_WITH_ERRORS => self::AUDIT_RUN_COMPLETED_WITH_ERRORS,
            PolicyApplicationRun::STATUS_FAILED => self::AUDIT_RUN_FAILED,
            PolicyApplicationRun::STATUS_CANCELLED => self::AUDIT_RUN_CANCELLED,
            default => null,
        };
        if ($event !== null) {
            $this->audit($event, $run, $actorId, ['from' => $from, 'to' => $to]);
        }

        return $run->fresh();
    }

    /**
     * Run-lifecycle audit only: sanitized metadata, never sensitive payloads.
     */
    private function audit(string $action, PolicyApplicationRun $run, ?string $userId, array $extra = []): void
    {
        AuditLog::create(array_merge([
            'user_id' => $userId,
            'action' => $action,
            'target_table' => 'policy_application_runs',
            'target_id' => $run->id,
            'details' => array_merge([
                'policy_version_id' => $run->policy_version_id,
                'scope_mode' => $run->scope_mode,
                'status' => $run->status,
            ], $extra),
        ], []));
    }
}
