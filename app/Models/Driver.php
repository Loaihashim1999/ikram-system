<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Driver extends Model
{
    use HasFactory, \Illuminate\Database\Eloquent\Concerns\HasUuids;

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'full_name',
        'phone',
        'vehicle_info',
        'is_active',
        'whatsapp_opt_in',
        'whatsapp_opt_in_at',
        'whatsapp_opt_out_at',
        'whatsapp_opt_in_source',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'whatsapp_opt_in' => 'boolean',
        'whatsapp_opt_in_at' => 'datetime',
        'whatsapp_opt_out_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    // العلاقات
    public function deliveryOrders(): HasMany
    {
        return $this->hasMany(DeliveryOrder::class);
    }
}
