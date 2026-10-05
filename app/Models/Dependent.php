<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Dependent extends Model
{
    use HasUuids;

    protected $fillable = [
        'beneficiary_id',
        'name',
        'relationship',
        'date_of_birth',
        'is_active',
    ];

    protected $casts = [
        'date_of_birth' => 'date',
        'is_active' => 'boolean',
    ];

    /**
     * Active registered household members only — the authoritative family-size
     * derivation never counts inactive/removed members.
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function beneficiary(): BelongsTo
    {
        return $this->belongsTo(Beneficiary::class);
    }
}
