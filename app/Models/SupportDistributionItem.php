<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class SupportDistributionItem extends Model
{
    use HasUuids;

    protected $guarded = ['id'];

    protected $casts = ['requested_quantity' => 'decimal:2', 'reserved_quantity' => 'decimal:2', 'fulfilled_quantity' => 'decimal:2'];

    public function distribution()
    {
        return $this->belongsTo(SupportDistribution::class, 'support_distribution_id');
    }

    public function inventoryItem()
    {
        return $this->belongsTo(InventoryItem::class);
    }
}
