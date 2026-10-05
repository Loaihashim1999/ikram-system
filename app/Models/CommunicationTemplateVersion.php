<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class CommunicationTemplateVersion extends Model
{
    use HasUuids;

    protected $guarded = ['id'];

    protected $casts = [
        'submitted_at' => 'datetime',
        'last_synced_at' => 'datetime',
        'activated_at' => 'datetime',
        'deactivated_at' => 'datetime',
        'provider_deleted_at' => 'datetime',
    ];

    public function scopeActive(Builder $query, string $key): Builder
    {
        return $query->where('internal_key', $key)
            ->where('provider_status', 'APPROVED')
            ->whereNotNull('activated_at')
            ->whereNull('deactivated_at')
            ->whereNull('provider_deleted_at')
            ->latest('activated_at');
    }
}
