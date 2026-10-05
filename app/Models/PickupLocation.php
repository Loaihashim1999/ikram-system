<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class PickupLocation extends Model
{
    use HasUuids;

    protected $fillable = ['location_url', 'name', 'address', 'city', 'district', 'is_active'];

    protected $casts = ['is_active' => 'boolean'];

    public function distributions()
    {
        return $this->hasMany(SupportDistribution::class);
    }
}
