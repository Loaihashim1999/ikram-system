<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Beneficiary extends Model
{
    use HasFactory;

    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'beneficiary_type', // citizen أو resident
        'full_name',
        'national_id',
        'phone',
        'date_of_birth',
        'place_of_birth',
        'city',
        'district',
        'street',
        'ocr_extracted_data',
        'national_id_image_url',
        'citizen_account_image_url',
        'social_security_image_url',
        'citizen_account_number',
        'social_security_number',
        'residence_id_image_url',
        'residence_issue_date',
        'residence_expiry_date',
        'nationality',
        'profession',
        'additional_document_number',
        'category_id',
        'has_special_needs',
        'status',
        'created_by',
    ];

    protected $casts = [
        'ocr_extracted_data' => 'array',
        'has_special_needs' => 'boolean',
        'date_of_birth' => 'date',
        'residence_issue_date' => 'date',
        'residence_expiry_date' => 'date',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    // العلاقات
    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function createdByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function distributions(): HasMany
    {
        return $this->hasMany(Distribution::class);
    }

    public function deliveryOrders(): HasMany
    {
        return $this->hasMany(DeliveryOrder::class);
    }

    public function documents(): HasMany
    {
        return $this->hasMany(BeneficiaryDocument::class);
    }
}