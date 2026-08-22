<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class RepDistribution extends Model
{
    use HasFactory, HasUuids;

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
        'rep_id',
        'basket_id',
        'driver_id',
        'basket_count',
        'target_beneficiaries_count',
        'scheduled_at',
        'barcode_code',
        'status',
        'picked_up_at',
        'is_documented',
    ];

    protected $casts = [
        'basket_count' => 'integer',
        'target_beneficiaries_count' => 'integer',
        'is_documented' => 'boolean',
        'scheduled_at' => 'datetime',
        'picked_up_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    // العلاقات
    public function rep(): BelongsTo
    {
        return $this->belongsTo(NeighborhoodRep::class, 'rep_id');
    }

    public function basket(): BelongsTo
    {
        return $this->belongsTo(Basket::class);
    }

    public function driver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'driver_id');
    }

    public function proofs(): HasMany
    {
        return $this->hasMany(RepDistributionProof::class);
    }
}
