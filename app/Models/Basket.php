<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

use Illuminate\Database\Eloquent\Concerns\HasUuids;

class Basket extends Model
{
    use HasFactory, HasUuids;

    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'id',
        'name',
        'description',
        'stock_quantity',
        'low_stock_threshold',
    ];

    protected $casts = [
        'stock_quantity' => 'integer',
        'low_stock_threshold' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    // العلاقات
    public function distributions(): HasMany
    {
        return $this->hasMany(Distribution::class);
    }

    public function staffDistributions(): HasMany
    {
        return $this->hasMany(StaffDistribution::class);
    }

    public function repDistributions(): HasMany
    {
        return $this->hasMany(RepDistribution::class);
    }

    public function deliveryOrders(): HasMany
    {
        return $this->hasMany(DeliveryOrder::class);
    }
}