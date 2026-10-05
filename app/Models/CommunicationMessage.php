<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class CommunicationMessage extends Model
{
    use HasUuids;

    protected $guarded = ['id'];

    protected $hidden = ['encrypted_payload', 'idempotency_key'];

    protected $casts = ['encrypted_payload' => 'encrypted:array', 'provider_diagnostics' => 'array', 'payload_expires_at' => 'datetime', 'requested_at' => 'datetime', 'sent_at' => 'datetime', 'next_attempt_at' => 'datetime', 'failed_at' => 'datetime'];
}
