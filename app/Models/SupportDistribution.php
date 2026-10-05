<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class SupportDistribution extends Model
{
    use HasUuids;

    protected $guarded = ['id'];

    protected $casts = ['support_date' => 'datetime', 'completed_at' => 'datetime', 'cancelled_at' => 'datetime'];

    public function items()
    {
        return $this->hasMany(SupportDistributionItem::class);
    }

    public function beneficiary()
    {
        return $this->belongsTo(Beneficiary::class);
    }

    public function staff()
    {
        return $this->belongsTo(Staff::class);
    }

    public function organization()
    {
        return $this->belongsTo(Organization::class);
    }

    public function pickupLocation()
    {
        return $this->belongsTo(PickupLocation::class);
    }

    public function driver()
    {
        return $this->belongsTo(Driver::class);
    }

    public function movements()
    {
        return $this->hasMany(InventoryMovement::class);
    }
}
