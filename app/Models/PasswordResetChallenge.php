<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class PasswordResetChallenge extends Model
{
    use HasUuids;

    protected $guarded = ['id'];

    protected $hidden = ['verifier', 'generation', 'recovery_token_hash'];

    protected $casts = [
        'failed_attempts' => 'integer',
        'send_count' => 'integer',
        'otp_expires_at' => 'datetime',
        'last_sent_at' => 'datetime',
        'send_window_start' => 'datetime',
        'locked_until' => 'datetime',
        'verified_at' => 'datetime',
        'recovery_expires_at' => 'datetime',
        'consumed_at' => 'datetime',
    ];
}
