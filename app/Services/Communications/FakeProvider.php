<?php

namespace App\Services\Communications;

class FakeProvider
{
    public function send(string $idempotencyKey, array $payload): string
    {
        // No network, file writes, or plaintext message capture. Deterministic fake acknowledgement.
        return 'fake-'.hash('sha256', $idempotencyKey);
    }
}
