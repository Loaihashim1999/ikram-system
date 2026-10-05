<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Validation\ValidationException;

/**
 * PolicyApplicationRun — POLICY-E application-scope run ledger (POLICY-E1).
 *
 * Records that an application scope (new_only / all_existing_and_new /
 * selected_existing_and_new / effective_from_date) of a published policy
 * version was simulated and later explicitly executed. A configuration default
 * is NOT execution authorization: runs are created only through
 * App\Services\BeneficiaryPolicy\PolicyApplicationRunService.
 *
 * State machine (no arbitrary mutation; use transitionTo):
 *   draft → simulated → approved_for_execution → running
 *         → completed | completed_with_errors | failed
 *   draft | simulated | approved_for_execution → cancelled
 * Terminal: completed, completed_with_errors, failed, cancelled.
 */
class PolicyApplicationRun extends Model
{
    use HasUuids;

    public const STATUS_DRAFT = 'draft';

    public const STATUS_SIMULATED = 'simulated';

    public const STATUS_APPROVED = 'approved_for_execution';

    public const STATUS_RUNNING = 'running';

    public const STATUS_COMPLETED = 'completed';

    public const STATUS_COMPLETED_WITH_ERRORS = 'completed_with_errors';

    public const STATUS_FAILED = 'failed';

    public const STATUS_CANCELLED = 'cancelled';

    public const STATUSES = [
        self::STATUS_DRAFT,
        self::STATUS_SIMULATED,
        self::STATUS_APPROVED,
        self::STATUS_RUNNING,
        self::STATUS_COMPLETED,
        self::STATUS_COMPLETED_WITH_ERRORS,
        self::STATUS_FAILED,
        self::STATUS_CANCELLED,
    ];

    /**
     * Legal transitions; keys are current status, values allowed targets.
     * POLICY-E3 adds completed_with_errors → running as the ONLY resumption
     * path: an explicit authorized retry re-enters `running` to reprocess
     * failed items; completed/failed/cancelled remain terminal.
     */
    public const TRANSITIONS = [
        self::STATUS_DRAFT => [self::STATUS_SIMULATED, self::STATUS_CANCELLED],
        self::STATUS_SIMULATED => [self::STATUS_APPROVED, self::STATUS_CANCELLED],
        self::STATUS_APPROVED => [self::STATUS_RUNNING, self::STATUS_CANCELLED],
        self::STATUS_RUNNING => [self::STATUS_COMPLETED, self::STATUS_COMPLETED_WITH_ERRORS, self::STATUS_FAILED],
        self::STATUS_COMPLETED => [],
        self::STATUS_COMPLETED_WITH_ERRORS => [self::STATUS_RUNNING],
        self::STATUS_FAILED => [],
        self::STATUS_CANCELLED => [],
    ];

    /** States from which cancellation is legal. */
    public const CANCELLABLE = [self::STATUS_DRAFT, self::STATUS_SIMULATED, self::STATUS_APPROVED];

    protected $guarded = ['id'];

    protected $casts = [
        'scope_parameters' => 'array',
        'simulation_summary' => 'array',
        'approved_at' => 'datetime',
        'total_candidates' => 'integer',
        'processed_count' => 'integer',
        'success_count' => 'integer',
        'review_count' => 'integer',
        'not_applicable_count' => 'integer',
        'failed_count' => 'integer',
        'simulated_at' => 'datetime',
        'execution_started_at' => 'datetime',
        'completed_at' => 'datetime',
        'cancelled_at' => 'datetime',
    ];

    public function policyVersion(): BelongsTo
    {
        return $this->belongsTo(BeneficiaryPolicyVersion::class, 'policy_version_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(PolicyApplicationRunItem::class, 'run_id');
    }

    public function requestedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    public function simulationCreatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'simulation_created_by');
    }

    public function executionRequestedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'execution_requested_by');
    }

    public function approvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function canTransitionTo(string $to): bool
    {
        return in_array($to, self::TRANSITIONS[$this->status] ?? [], true);
    }

    /**
     * Guarded transition: rejects any target outside TRANSITIONS and stamps the
     * matching lifecycle timestamp/actor. Never mutates to an unknown status.
     *
     * @throws ValidationException
     */
    public function transitionTo(string $to, ?string $actorId = null): void
    {
        if (! in_array($to, self::STATUSES, true) || ! $this->canTransitionTo($to)) {
            throw ValidationException::withMessages([
                'status' => "انتقال غير مسموح لحالة تشغيل نطاق السياسة: {$this->status} → {$to}.",
            ]);
        }

        $this->status = $to;
        switch ($to) {
            case self::STATUS_SIMULATED:
                $this->simulated_at = now();
                if ($actorId) {
                    $this->simulation_created_by = $actorId;
                }
                break;
            case self::STATUS_APPROVED:
                $this->approved_at = now();
                if ($actorId) {
                    $this->approved_by = $actorId;
                }
                break;
            case self::STATUS_RUNNING:
                $this->execution_started_at = now();
                if ($actorId) {
                    $this->execution_requested_by = $actorId;
                }
                break;
            case self::STATUS_COMPLETED:
            case self::STATUS_COMPLETED_WITH_ERRORS:
            case self::STATUS_FAILED:
                $this->completed_at = now();
                break;
            case self::STATUS_CANCELLED:
                $this->cancelled_at = now();
                break;
        }
        $this->save();
    }
}
