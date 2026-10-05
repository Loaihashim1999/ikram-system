<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SocialAssessment extends Model
{
    use HasFactory, HasUuids;

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'beneficiary_id', 'policy_version_id', 'evaluation_id',
        'researcher_type', 'researcher_id',
        'assessment_date', 'housing_condition', 'service_area_result',
        'landlord_relationship_result', 'household_findings',
        'structured_recommendation', 'controlled_notes', 'status',
        'created_by', 'updated_by',
    ];

    protected $casts = [
        'assessment_date' => 'date',
        'household_findings' => 'array',
        'status' => 'string',
    ];

    public function beneficiary(): BelongsTo
    {
        return $this->belongsTo(Beneficiary::class);
    }

    public function evaluation(): BelongsTo
    {
        return $this->belongsTo(BeneficiaryPolicyEvaluation::class, 'evaluation_id');
    }

    public function policyVersion(): BelongsTo
    {
        return $this->belongsTo(BeneficiaryPolicyVersion::class, 'policy_version_id');
    }

    public function researcher(): BelongsTo
    {
        return $this->belongsTo(User::class, 'researcher_id');
    }
}
