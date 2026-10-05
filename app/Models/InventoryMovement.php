<?php

namespace App\Models;

use App\Services\NotificationService;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class InventoryMovement extends Model
{
    use HasFactory;

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'inventory_item_id', 'type', 'quantity', 'reason', 'user_id', 'balance_after', 'support_distribution_id',
    ];

    protected $casts = [
        'quantity' => 'decimal:2',
        'balance_after' => 'decimal:2',
    ];

    protected static function boot()
    {
        parent::boot();
        static::creating(function ($model) {
            if (empty($model->{$model->getKeyName()})) {
                $model->{$model->getKeyName()} = (string) Str::uuid();
            }
        });
        static::created(function ($movement) {
            if ($movement->support_distribution_id) {
                DB::afterCommit(fn () => NotificationService::notifyAll(
                    'stock_changed', 'تم صرف مخزون لعملية الدعم '.$movement->support_distribution_id, $movement
                ));

                return;
            }
            DB::afterCommit(fn () => NotificationService::notifyAll(
                'stock_changed',
                "تم تسجيل حركة مخزون جديدة: نوع الحركة ({$movement->type}) بمقدار ({$movement->quantity})",
                $movement
            ));
        });
    }

    public function item()
    {
        return $this->belongsTo(InventoryItem::class, 'inventory_item_id');
    }

    public function inventoryItem()
    {
        return $this->belongsTo(InventoryItem::class, 'inventory_item_id');
    }

    public function supportDistribution()
    {
        return $this->belongsTo(SupportDistribution::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
