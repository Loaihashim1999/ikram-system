<?php

namespace App\Services\Communications;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * SMS delivery reports stay refused until Taqnyat documents the callback
 * method, payload, authentication, event identity, and delivery states.
 * The acknowledgement phrase confirms receipt to Taqnyat. It does not
 * authenticate the caller and is not returned while processing is closed.
 */
class TaqnyatSmsDeliveryWebhook
{
    public function receive(Request $request): JsonResponse
    {
        if ($this->oversized($request)) {
            $this->record('oversized');

            return $this->closed();
        }

        if (! $this->enabled()) {
            $this->record('disabled');

            return $this->closed();
        }

        $this->record('provider_contract_missing');

        return $this->closed();
    }

    public function acknowledgement(): string
    {
        $phrase = config('services.taqnyat.sms_webhook.acknowledgement');

        return is_string($phrase) ? $phrase : '';
    }

    private function enabled(): bool
    {
        return config('services.taqnyat.sms_webhook.enabled') === true
            && $this->acknowledgement() !== '';
    }

    private function oversized(Request $request): bool
    {
        $limit = (int) config('services.taqnyat.sms_webhook.max_body_bytes', 8192);
        $declared = (int) $request->server('CONTENT_LENGTH', 0);

        return ($declared > $limit) || (strlen($request->getContent()) > $limit);
    }

    private function closed(): JsonResponse
    {
        return response()->json([
            'status' => 'unavailable',
        ], 503);
    }

    private function record(string $category): void
    {
        try {
            Log::info('taqnyat_sms_webhook', [
                'result' => 'rejected',
                'category' => $category,
            ]);
        } catch (\Throwable) {
            // A logging failure must not change the closed response.
        }
    }
}
