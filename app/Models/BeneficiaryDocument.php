<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BeneficiaryDocument extends Model
{
    use HasFactory;

    protected $table = 'beneficiary_documents';

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'beneficiary_id',
        'document_type',
        'file_url',
        'file_type',
        'ocr_data',
    ];

    protected $casts = [
        'ocr_data' => 'array',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function beneficiary(): BelongsTo
    {
        return $this->belongsTo(Beneficiary::class);
    }
}
