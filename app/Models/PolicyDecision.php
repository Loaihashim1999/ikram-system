<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PolicyDecision extends Model
{
    use HasFactory, HasUuids;

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'evaluation_id', 'policy_version_id',
        'decision', 'decided_by', 'decided_at',
        'stable_reason_code', 'human_readable_reason',
        'evidence_summary_reference',
    ];

    protected $casts = [
        'decided_at' => 'datetime',
        'evidence_summary_reference' => 'array',
        'decision' => 'string',
        'stable_reason_code' => 'string',
    ];

    public function evaluation(): BelongsTo
    {
        return $this->belongsTo(BeneficiaryPolicyEvaluation::class);
    }
}
