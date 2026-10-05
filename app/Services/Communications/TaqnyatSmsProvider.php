<?php

namespace App\Services\Communications;

use App\Contracts\Communications\SmsProviderInterface;

class TaqnyatSmsProvider extends TaqnyatProvider implements SmsProviderInterface
{
    public function __construct(private readonly SaudiPhoneNumber $phones) {}

    public function send(string $idempotencyKey, array $payload): string
    {
        $recipient = $this->phones->normalize($payload['destination'] ?? null);
        $response = $this->post('services.taqnyat.sms.token', rtrim($this->required('services.taqnyat.api_base_url'), '/').'/v1/messages', [
            'recipients' => [$recipient],
            'body' => (string) ($payload['body'] ?? ''),
            'sender' => $this->required('services.taqnyat.sms.sender'),
        ]);
        $data = $response->json();
        $messageId = $data['messageId'] ?? null;
        $rejected = $data['rejected'] ?? [];
        if ((is_array($rejected) && $rejected !== []) || (is_string($rejected) && ! in_array(trim($rejected), ['', '[]'], true))) {
            throw new ProviderFailure('provider_rejected', false);
        }
        if ($response->status() !== 201 || (int) ($data['statusCode'] ?? 0) !== 201 || (! is_string($messageId) && ! is_int($messageId))) {
            $this->malformed($response);
        }

        return (string) $messageId;
    }
}
