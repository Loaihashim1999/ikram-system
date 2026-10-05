<?php

namespace App\Contracts\Communications;

interface MessageProviderInterface
{
    /** The stable outbox key is supplied when the provider supports idempotency; never log payload or response bodies. */
    public function send(string $idempotencyKey, array $payload): string;
}
