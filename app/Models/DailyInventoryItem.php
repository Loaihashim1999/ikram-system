<?php

namespace App\Models;

use App\Services\InventoryExpiryPolicy;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class DailyInventoryItem extends Model
{
    use HasFactory, HasUuids, SoftDeletes;

    protected $table = 'daily_inventory_items';

    protected $fillable = [
        'name',
        'unit',
        'current_quantity',
        'reserved_quantity',
        'min_threshold',
        'category',
        'batch_number',
        'supplier',
        'expiry_date',
        'expiration_date',
        'description',
        'status',
    ];

    protected $casts = [
        'current_quantity' => 'integer',
        'reserved_quantity' => 'integer',
        'min_threshold' => 'integer',
        'expiry_date' => 'date:Y-m-d',
    ];

    protected $appends = [
        'available_quantity',
        'is_low_stock',
        'is_expired',
        'remaining_days',
        'expiry_status',
        'expiration_date',
    ];

    public function getExpirationDateAttribute(): ?string
    {
        return $this->expiry_date ? $this->expiry_date->format('Y-m-d') : null;
    }

    public function setExpirationDateAttribute($value): void
    {
        $this->attributes['expiry_date'] = $value ? substr((string) $value, 0, 10) : null;
    }

    public function movements(): HasMany
    {
        return $this->hasMany(DailyInventoryMovement::class, 'daily_inventory_item_id')->latest();
    }

    public function receivingTransactions(): HasMany
    {
        return $this->hasMany(DailyReceivingTransaction::class, 'daily_inventory_item_id');
    }

    public function getAvailableQuantityAttribute(): int
    {
        return max(0, $this->current_quantity - $this->reserved_quantity);
    }

    public function getIsLowStockAttribute(): bool
    {
        return $this->current_quantity <= $this->min_threshold;
    }

    public function getIsExpiredAttribute(): bool
    {
        return $this->expiry_status === 'expired';
    }

    public function getRemainingDaysAttribute(): ?int
    {
        if (! $this->expiry_date) {
            return null;
        }

        return Carbon::today()->diffInDays($this->expiry_date->copy()->startOfDay(), false);
    }

    public function getExpiryStatusAttribute(): ?string
    {
        return InventoryExpiryPolicy::status($this->remaining_days);
    }
}
