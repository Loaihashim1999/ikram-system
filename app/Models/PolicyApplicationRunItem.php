<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Validation\ValidationException;

/**
 * PolicyApplicationRunItem — one beneficiary inside a POLICY-E application run.
 *
 * Unique (run_id, beneficiary_id) at the database level is the idempotency
 * backstop: two executors can never create duplicate work for the same
 * beneficiary inside one run.
 *
 * Item state machine (populated by POLICY-E2/E3; foundation only in E1):
 *   pending → simulated → processing → completed | review_required | not_applicable | failed
 *   failed → processing (explicit retry only)
 *   pending | simulated → cancelled
 */
class PolicyApplicationRunItem extends Model
{
    use HasUuids;

    public const STATUS_PENDING = 'pending';

    public const STATUS_SIMULATED = 'simulated';

    public const STATUS_PROCESSING = 'processing';

    public const STATUS_COMPLETED = 'completed';

    public const STATUS_REVIEW_REQUIRED = 'review_required';

    public const STATUS_NOT_APPLICABLE = 'not_applicable';

    public const STATUS_FAILED = 'failed';

    public const STATUS_CANCELLED = 'cancelled';

    public const STATUSES = [
        self::STATUS_PENDING,
        self::STATUS_SIMULATED,
        self::STATUS_PROCESSING,
        self::STATUS_COMPLETED,
        self::STATUS_REVIEW_REQUIRED,
        self::STATUS_NOT_APPLICABLE,
        self::STATUS_FAILED,
        self::STATUS_CANCELLED,
    ];

    public const TRANSITIONS = [
        self::STATUS_PENDING => [self::STATUS_SIMULATED, self::STATUS_CANCELLED],
        self::STATUS_SIMULATED => [self::STATUS_PROCESSING, self::STATUS_CANCELLED],
        self::STATUS_PROCESSING => [self::STATUS_COMPLETED, self::STATUS_REVIEW_REQUIRED, self::STATUS_NOT_APPLICABLE, self::STATUS_FAILED],
        self::STATUS_FAILED => [self::STATUS_PROCESSING],
        self::STATUS_COMPLETED => [],
        self::STATUS_REVIEW_REQUIRED => [],
        self::STATUS_NOT_APPLICABLE => [],
        self::STATUS_CANCELLED => [],
    ];

    protected $guarded = ['id'];

    protected $casts = [
        'simulation_result' => 'array',
        'attempt_count' => 'integer',
        'processed_at' => 'datetime',
    ];

    public function run(): BelongsTo
    {
        return $this->belongsTo(PolicyApplicationRun::class, 'run_id');
    }

    public function beneficiary(): BelongsTo
    {
        return $this->belongsTo(Beneficiary::class, 'beneficiary_id');
    }

    public function sourceEvaluation(): BelongsTo
    {
        return $this->belongsTo(BeneficiaryPolicyEvaluation::class, 'source_evaluation_id');
    }

    public function newEvaluation(): BelongsTo
    {
        return $this->belongsTo(BeneficiaryPolicyEvaluation::class, 'new_evaluation_id');
    }

    public function canTransitionTo(string $to): bool
    {
        return in_array($to, self::TRANSITIONS[$this->status] ?? [], true);
    }

    /**
     * @throws ValidationException
     */
    public function transitionTo(string $to): void
    {
        if (! in_array($to, self::STATUSES, true) || ! $this->canTransitionTo($to)) {
            throw ValidationException::withMessages([
                'status' => "انتقال غير مسموح لحالة عنصر تشغيل السياسة: {$this->status} → {$to}.",
            ]);
        }

        $this->status = $to;
        if ($to === self::STATUS_PROCESSING) {
            $this->attempt_count = $this->attempt_count + 1;
            $this->processed_at = null;
        }
        if (in_array($to, [self::STATUS_COMPLETED, self::STATUS_REVIEW_REQUIRED, self::STATUS_NOT_APPLICABLE, self::STATUS_FAILED], true)) {
            $this->processed_at = now();
        }
        $this->save();
    }
}
