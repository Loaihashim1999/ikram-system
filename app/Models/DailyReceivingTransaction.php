<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DailyReceivingTransaction extends Model
{
    use HasFactory, HasUuids;

    protected $table = 'daily_receiving_transactions';

    protected $fillable = [
        'document_number',
        'daily_beneficiary_id',
        'daily_inventory_item_id',
        'basket_type_name',
        'quantity',
        'status',
        'receiving_date',
        'authorized_user_id',
        'notes',
    ];

    protected $casts = [
        'quantity' => 'integer',
        'receiving_date' => 'datetime',
    ];

    public function beneficiary(): BelongsTo
    {
        return $this->belongsTo(DailyBeneficiary::class, 'daily_beneficiary_id')->withTrashed();
    }

    public function inventoryItem(): BelongsTo
    {
        return $this->belongsTo(DailyInventoryItem::class, 'daily_inventory_item_id')->withTrashed();
    }

    public function authorizedUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'authorized_user_id');
    }
}
