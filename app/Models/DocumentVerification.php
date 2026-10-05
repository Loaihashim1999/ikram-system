<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DocumentVerification extends Model
{
    use HasFactory, HasUuids;

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'beneficiary_id', 'document_id', 'evaluation_id',
        'document_code', 'verification_status', 'verified_by', 'verified_at',
        'rejection_reason', 'evidence_reference',
    ];

    protected $casts = [
        'verified_at' => 'datetime',
        'verification_status' => 'string',
        'document_code' => 'string',
    ];

    public function beneficiary(): BelongsTo
    {
        return $this->belongsTo(Beneficiary::class);
    }

    public function document(): BelongsTo
    {
        return $this->belongsTo(BeneficiaryDocument::class, 'document_id');
    }

    public function evaluation(): BelongsTo
    {
        return $this->belongsTo(BeneficiaryPolicyEvaluation::class, 'evaluation_id');
    }
}
