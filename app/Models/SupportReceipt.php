<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class SupportReceipt extends Model
{
    use HasUuids;

    protected $guarded = ['id'];

    protected $hidden = ['proof_snapshot'];

    protected $casts = ['confirmed_at' => 'datetime', 'proof_snapshot' => 'array'];

    protected static function booted(): void
    {
        static::updating(function (self $receipt) {
            if ($receipt->isDirty('proof_snapshot')) {
                throw new \LogicException('Receipt proof snapshots are immutable.');
            }
        });
    }
}
