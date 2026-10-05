<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class DriverAssignment extends Model
{
    use HasUuids;

    protected $guarded = ['id'];

    protected $hidden = ['token_hash', 'capability_ciphertext'];

    protected $casts = ['expires_at' => 'datetime', 'revoked_at' => 'datetime', 'completed_at' => 'datetime', 'last_used_at' => 'datetime', 'expiry_audited_at' => 'datetime', 'capability_ciphertext' => 'encrypted'];

    public function tasks()
    {
        return $this->belongsToMany(SupportDistribution::class, 'driver_assignment_tasks')->wherePivotNull('released_at');
    }

    public function driver()
    {
        return $this->belongsTo(Driver::class);
    }
}
