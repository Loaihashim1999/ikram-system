<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class ReceiptChallenge extends Model
{
    use HasUuids;

    protected $guarded = ['id'];

    protected $hidden = ['verifier', 'generation'];

    protected $casts = ['expires_at' => 'datetime', 'locked_until' => 'datetime', 'consumed_at' => 'datetime'];
}
