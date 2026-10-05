<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

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
                $model->{$model->getKeyName()} = (string) Str::uuid();
            }
        });
    }

    protected $fillable = [
        'full_name',
        'organization_name',
        'organization_type',
        'license_number',
        'contact_person',
        'email',
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

    public function getIdDocumentImageUrlAttribute(): ?string
    {
        return $this->privateDocumentUrl('id_document_image_url');
    }

    public function getSupportLetterUrlAttribute(): ?string
    {
        return $this->privateDocumentUrl('support_letter_url');
    }

    public function getNationalAddressDocUrlAttribute(): ?string
    {
        return $this->privateDocumentUrl('national_address_doc_url');
    }

    public function getDependentsIdsZipUrlAttribute(): ?string
    {
        return $this->privateDocumentUrl('dependents_ids_zip_url');
    }

    private function privateDocumentUrl(string $field): ?string
    {
        $path = $this->getRawOriginal($field);
        if (! is_string($path) || $path === '' || str_contains($path, '://') || str_starts_with($path, '/')) {
            return null;
        }

        return route('neighborhood-reps.documents.download', [
            'representative' => $this->getKey(),
            'field' => $field,
        ]);
    }

    // العلاقات
    public function repDistributions(): HasMany
    {
        return $this->hasMany(RepDistribution::class, 'rep_id');
    }
}
