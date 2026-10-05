<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DailyBeneficiaryDocument extends Model
{
    use HasFactory, HasUuids;

    protected $table = 'daily_beneficiary_documents';

    protected $fillable = [
        'daily_beneficiary_id',
        'document_type',
        'file_name',
        'file_path',
        'file_url',
        'file_type',
        'file_size',
        'uploaded_by',
    ];

    public function dailyBeneficiary(): BelongsTo
    {
        return $this->belongsTo(DailyBeneficiary::class, 'daily_beneficiary_id');
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }
}
