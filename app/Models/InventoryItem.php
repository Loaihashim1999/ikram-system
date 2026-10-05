<?php

namespace App\Models;

use App\Services\InventoryExpiryPolicy;
use App\Services\SupportQuantity;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class InventoryItem extends Model
{
    use HasFactory;

    protected $appends = [
        'stock_status',
        'remaining_days',
        'expiry_status',
        'expiry_date',
        'expiration_date',
        'available_quantity',
    ];

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'name',
        'unit',
        'current_quantity',
        'reserved_quantity',
        'min_threshold',
        'description',
        'expiration_date',
        'expiry_date',
        'basket_number',
    ];

    protected $casts = [
        'current_quantity' => 'decimal:2',
        'reserved_quantity' => 'decimal:2',
        'min_threshold' => 'decimal:2',
        'expiration_date' => 'date:Y-m-d',
    ];

    public function getExpirationDateAttribute(): ?string
    {
        $val = $this->attributes['expiration_date'] ?? null;

        return $val ? substr((string) $val, 0, 10) : null;
    }

    public function getExpiryDateAttribute(): ?string
    {
        return $this->expiration_date;
    }

    public function setExpiryDateAttribute($value): void
    {
        $this->attributes['expiration_date'] = $value ? substr((string) $value, 0, 10) : null;
    }

    public function setExpirationDateAttribute($value): void
    {
        $this->attributes['expiration_date'] = $value ? substr((string) $value, 0, 10) : null;
    }

    public function getRemainingDaysAttribute(): ?int
    {
        $date = $this->attributes['expiration_date'] ?? null;
        if (! $date) {
            return null;
        }

        return (int) Carbon::today()->diffInDays(Carbon::parse($date)->startOfDay(), false);
    }

    public function getExpiryStatusAttribute(): ?string
    {
        return InventoryExpiryPolicy::status($this->remaining_days);
    }

    protected static function boot()
    {
        parent::boot();
        static::creating(function ($model) {
            if (empty($model->{$model->getKeyName()})) {
                $model->{$model->getKeyName()} = (string) Str::uuid();
            }
        });
    }

    public function movements()
    {
        return $this->hasMany(InventoryMovement::class);
    }

    // الكمية المتاحة = الحالية - المحجوزة، بدون قصّ إلى صفر:
    // أي قيمة سالبة تعني خرقًا لثابت (reserved <= current) ويُعامل كخطور سلامة بيانات.
    public function getAvailableQuantityAttribute(): string
    {
        if ((float) $this->current_quantity < 0 || (float) $this->reserved_quantity < 0 || (float) $this->reserved_quantity > (float) $this->current_quantity) {
            throw new \LogicException('Inventory reservation invariant violated: '.$this->id);
        }

        return SupportQuantity::subtract($this->current_quantity ?? '0', $this->reserved_quantity ?? '0');
    }

    // دالة مساعدة لتحديد حالة المخزون
    public function getStockStatusAttribute()
    {
        if ($this->current_quantity == 0) {
            return 'out_of_stock';
        }
        if ($this->current_quantity <= $this->min_threshold) {
            return 'low_stock';
        }

        return 'in_stock';
    }
}
