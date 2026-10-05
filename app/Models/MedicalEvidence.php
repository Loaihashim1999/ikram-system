<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MedicalEvidence extends Model
{
    use HasFactory, HasUuids;

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'beneficiary_id', 'evaluation_id',
        'verified_disability_percentage', 'verification_status',
        'verified_by', 'verified_at', 'evidence_reference',
        'rejection_reason', 'medical_notes',
    ];

    protected $casts = [
        'verified_at' => 'datetime',
        'verified_disability_percentage' => 'decimal:2',
        'verification_status' => 'string',
    ];

    public function beneficiary(): BelongsTo
    {
        return $this->belongsTo(Beneficiary::class);
    }

    public function evaluation(): BelongsTo
    {
        return $this->belongsTo(BeneficiaryPolicyEvaluation::class, 'evaluation_id');
    }
}
