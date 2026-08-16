<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\HasMany;

use Illuminate\Database\Eloquent\Concerns\HasUuids;

class Distribution extends Model
{
    use HasFactory, HasUuids;

    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'id',
        'beneficiary_id',
        'basket_id',
        'assigned_by',
        'scheduled_at',
        'pickup_location',
        'barcode_code',
        'status',
        'sms_status',
        'delivered_at',
    ];

    protected $casts = [
        'scheduled_at' => 'datetime',
        'delivered_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    // العلاقات
    public function beneficiary(): BelongsTo
    {
        return $this->belongsTo(Beneficiary::class);
    }

    public function basket(): BelongsTo
    {
        return $this->belongsTo(Basket::class);
    }

    public function assignedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_by');
    }

    public function receipt(): HasOne
    {
        return $this->hasOne(Receipt::class);
    }

    public function notifications(): HasMany
    {
        return $this->hasMany(Notification::class, 'related_record_id');
    }
}