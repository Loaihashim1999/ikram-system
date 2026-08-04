<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class NeighborhoodRep extends Model
{
    use HasFactory;

    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'full_name',
        'phone',
        'id_document_image_url',
        'district_name',
        'district_location_lat',
        'district_location_lng',
        'beneficiaries_count',
        'support_letter_url',
    ];

    protected $casts = [
        'beneficiaries_count' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    // العلاقات
    public function repDistributions(): HasMany
    {
        return $this->hasMany(RepDistribution::class, 'rep_id');
    }
}