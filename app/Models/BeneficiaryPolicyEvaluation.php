<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * BeneficiaryPolicyEvaluation — permanent policy evaluation snapshot (POLICY-A).
 *
 * Snapshots are immutable records: old evaluations are never overwritten when
 * policy settings or beneficiary data change; a new evaluation always creates
 * a new record.
 */
class BeneficiaryPolicyEvaluation extends Model
{
    use HasUuids;

    public const STATUS_COMPLETED = 'completed';

    public const STATUS_FAILED = 'failed';

    public const STATUSES = [self::STATUS_COMPLETED, self::STATUS_FAILED];

    /** POLICY-B intermediate eligibility decisions (final verdict stays unset until POLICY-C/D). */
    public const ELIGIBILITY_ELIGIBLE = 'eligible';

    public const ELIGIBILITY_INELIGIBLE = 'ineligible';

    public const ELIGIBILITY_REVIEW_REQUIRED = 'review_required';

    public const ELIGIBILITY_NOT_APPLICABLE = 'not_applicable';

    public const ELIGIBILITY_DECISIONS = [
        self::ELIGIBILITY_ELIGIBLE,
        self::ELIGIBILITY_INELIGIBLE,
        self::ELIGIBILITY_REVIEW_REQUIRED,
        self::ELIGIBILITY_NOT_APPLICABLE,
    ];

    protected $guarded = ['id'];

    protected $casts = [
        'evaluated_at' => 'datetime',
        'input_snapshot' => 'array',
        'financial_snapshot' => 'array',
        'scoring_snapshot' => 'array',
        'degree_classification_snapshot' => 'array',
        'need_level_snapshot' => 'array',
        'eligibility_reasons' => 'array',
        'gross_counted_income' => 'decimal:2',
        'monthly_rent' => 'decimal:2',
        'family_member_deduction' => 'decimal:2',
        'adjusted_net_household_income' => 'decimal:2',
        'net_income_per_capita' => 'decimal:2',
        'policy_score' => 'decimal:4',
        'family_size' => 'integer',
    ];

    public function beneficiary(): BelongsTo
    {
        return $this->belongsTo(Beneficiary::class, 'beneficiary_id');
    }

    public function policyVersion(): BelongsTo
    {
        return $this->belongsTo(BeneficiaryPolicyVersion::class, 'policy_version_id');
    }

    public function evaluator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'evaluated_by');
    }
}
