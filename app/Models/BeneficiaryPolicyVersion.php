<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * BeneficiaryPolicyVersion — canonical policy version entity (POLICY-A).
 *
 * Lifecycle: draft → (approve) → published → retired.
 * Published/retired records are immutable; any change requires a clone/new draft.
 */
class BeneficiaryPolicyVersion extends Model
{
    use HasUuids;

    public const STATUS_DRAFT = 'draft';

    public const STATUS_PUBLISHED = 'published';

    public const STATUS_RETIRED = 'retired';

    public const STATUSES = [self::STATUS_DRAFT, self::STATUS_PUBLISHED, self::STATUS_RETIRED];

    /** Default policy scope — the Version-4 citizen beneficiary policy. Residents are governed separately. */
    public const DEFAULT_SCOPE = 'citizen_beneficiaries';

    public const ALLOWED_SCOPES = [self::DEFAULT_SCOPE];

    protected $guarded = ['id'];

    protected $casts = [
        'effective_from' => 'date:Y-m-d',
        'effective_to' => 'date:Y-m-d',
        'board_approval_date' => 'date:Y-m-d',
        'configuration' => 'array',
        'approved_at' => 'datetime',
        'published_at' => 'datetime',
        'retired_at' => 'datetime',
    ];

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function publisher(): BelongsTo
    {
        return $this->belongsTo(User::class, 'published_by');
    }

    public function retirer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'retired_by');
    }

    public function parentVersion(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_version_id');
    }

    public function evaluations(): HasMany
    {
        return $this->hasMany(BeneficiaryPolicyEvaluation::class, 'policy_version_id');
    }

    /** POLICY-E1: application-scope run ledger entries for this version. */
    public function applicationRuns(): HasMany
    {
        return $this->hasMany(PolicyApplicationRun::class, 'policy_version_id');
    }

    public function isDraft(): bool
    {
        return $this->status === self::STATUS_DRAFT;
    }

    public function isPublished(): bool
    {
        return $this->status === self::STATUS_PUBLISHED;
    }

    public function isRetired(): bool
    {
        return $this->status === self::STATUS_RETIRED;
    }

    /** Published/retired records are immutable — never editable in place. */
    public function isImmutable(): bool
    {
        return ! $this->isDraft();
    }
}
