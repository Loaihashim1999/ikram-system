<?php

namespace App\Models;

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
    ];

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
        if (! $this->expiry_date) {
            return null;
        }

        if ($this->remaining_days <= 0) {
            return 'expired';
        }

        $threshold = max(0, (int) \App\Models\Setting::get('warehouse_alert_threshold_days', 10));

        return $this->remaining_days <= $threshold ? 'near_expiry' : 'valid';
    }
}
