<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DailyInventoryMovement extends Model
{
    use HasFactory, HasUuids;

    protected $table = 'daily_inventory_movements';

    protected $fillable = [
        'daily_inventory_item_id',
        'type', // in, out, adjustment
        'quantity',
        'reason',
        'notes',
        'user_id',
        'related_receiving_id',
    ];

    protected $casts = [
        'quantity' => 'integer',
    ];

    public function item(): BelongsTo
    {
        return $this->belongsTo(DailyInventoryItem::class, 'daily_inventory_item_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
