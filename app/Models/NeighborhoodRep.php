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

    protected static function boot()
    {
        parent::boot();
        static::creating(function ($model) {
            if (empty($model->{$model->getKeyName()})) {
                $model->{$model->getKeyName()} = (string) \Illuminate\Support\Str::uuid();
            }
        });
    }

    protected $fillable = [
        'full_name',
        'phone',
        'national_id',
        'date_of_birth',
        'district_name',
        'city',
        'status',
        'national_address',
        'id_document_image_url',
        'district_location_lat',
        'district_location_lng',
        'beneficiaries_count',
        'support_letter_url',
        'national_address_doc_url',
        'dependents_ids_zip_url',
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
