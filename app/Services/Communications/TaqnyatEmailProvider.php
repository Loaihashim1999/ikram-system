<?php

namespace App\Services\Communications;

use App\Contracts\Communications\EmailProviderInterface;

class TaqnyatEmailProvider extends TaqnyatProvider implements EmailProviderInterface
{
    public function send(string $idempotencyKey, array $payload): string
    {
        $destination = filter_var($payload['destination'] ?? null, FILTER_VALIDATE_EMAIL);
        if (! $destination) {
            throw new ProviderFailure('invalid_destination', false);
        }
        $response = $this->post('services.taqnyat.email.token', rtrim($this->required('services.taqnyat.api_base_url'), '/').'/mailSend.php', [
            'campaignName' => $this->required('services.taqnyat.email.campaign'),
            'subject' => (string) ($payload['subject'] ?? ''),
            'from' => $this->required('services.taqnyat.email.from'),
            'to' => [$destination],
            'msg' => (string) ($payload['body'] ?? ''),
        ]);
        $data = $response->json();
        $messageId = $data['Data']['msgId'] ?? null;
        if ($response->status() !== 201 || ($data['ResponseStatus'] ?? null) !== 'success' || (! is_string($messageId) && ! is_int($messageId))) {
            if (($data['ResponseStatus'] ?? null) === 'fail' || isset($data['Error'])) {
                throw new ProviderFailure('provider_rejected', false);
            }
            $this->malformed($response);
        }

        return (string) $messageId;
    }
}
