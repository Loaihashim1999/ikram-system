<?php

namespace App\Services\Communications;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;

abstract class TaqnyatProvider
{
    protected function required(string $key): string
    {
        $value = config($key);
        if (! is_string($value) || trim($value) === '') {
            throw new ProviderFailure('provider_not_configured', false);
        }

        return trim($value);
    }

    protected function post(string $tokenKey, string $url, array $payload): Response
    {
        return $this->request('post', $tokenKey, $url, $payload);
    }

    protected function get(string $tokenKey, string $url, array $query = []): Response
    {
        return $this->request('get', $tokenKey, $url, $query);
    }

    protected function delete(string $tokenKey, string $url, array $payload): Response
    {
        return $this->request('delete', $tokenKey, $url, $payload);
    }

    private function request(string $method, string $tokenKey, string $url, array $payload): Response
    {
        try {
            $client = Http::withToken($this->required($tokenKey))
                ->acceptJson()
                ->asJson()
                ->connectTimeout((int) config('services.taqnyat.connect_timeout', 5))
                ->timeout((int) config('services.taqnyat.timeout', 10));
            $response = $method === 'get'
                ? $client->get($url, $payload)
                : $client->{$method}($url, $payload);
        } catch (ConnectionException) {
            throw new ProviderFailure('provider_timeout', true, ['provider_error_class' => 'provider_timeout']);
        }

        $diagnostics = $this->diagnostics($response);
        $providerCode = $diagnostics['provider_error_code'] ?? null;
        $providerReason = $diagnostics['provider_reason'] ?? null;
        $responsePayload = $response->json();
        $errorEnvelope = is_array($responsePayload) && (
            $providerReason !== null
            || ($responsePayload['ResponseStatus'] ?? null) === 'fail'
            || (isset($responsePayload['Error']) && $responsePayload['Error'] !== null)
        );
        $category = match ((string) $providerCode) {
            '101' => 'provider_api_disabled',
            '102' => 'provider_ip_not_authorized',
            '104', '401' => 'provider_authentication',
            default => null,
        };
        if ($response->status() === 429) {
            $this->fail('provider_rate_limited', true, $diagnostics);
        }
        if ($response->serverError()) {
            $this->fail('provider_temporary', true, $diagnostics);
        }
        if ($response->status() === 401 || $response->status() === 403) {
            $this->fail('provider_authentication', false, $diagnostics);
        }
        if ($response->clientError()) {
            $this->fail($category ?? 'provider_rejected', false, $diagnostics);
        }
        if ($errorEnvelope) {
            $this->fail($category ?? 'provider_rejected', false, $diagnostics);
        }

        return $response;
    }

    protected function malformed(?Response $response = null): never
    {
        $this->fail('provider_malformed_response', false, $response ? $this->diagnostics($response) : []);
    }

    private function fail(string $category, bool $retryable, array $diagnostics): never
    {
        $diagnostics['provider_error_class'] = $category;

        throw new ProviderFailure($category, $retryable, $diagnostics);
    }

    private function diagnostics(Response $response): array
    {
        $decoded = json_decode($response->body(), true);
        $isJson = json_last_error() === JSON_ERROR_NONE && is_array($decoded);
        $payload = $isJson ? $decoded : [];
        $code = $this->firstScalar($payload, ['message', 'statusCode', 'Error.ErrorCode', 'error.code', 'code']);
        $reason = $this->firstScalar($payload, ['reason', 'Error.MessageEn', 'error.message']);
        $contentType = trim((string) $response->header('Content-Type'));

        return array_filter([
            'http_status' => $response->status(),
            'content_type' => $contentType === '' ? null : mb_substr(preg_replace('/[^a-zA-Z0-9;=+._\-\/ ]/', '', $contentType) ?? '', 0, 120),
            'response_is_json' => $isJson,
            'top_level_json_keys' => $isJson ? array_values(array_slice(array_filter(array_map(
                fn ($key) => preg_match('/^[a-zA-Z0-9_.-]{1,80}$/D', (string) $key) ? (string) $key : null,
                array_keys($payload),
            )), 0, 30)) : [],
            'provider_error_code' => $code === null ? null : mb_substr(preg_replace('/[^a-zA-Z0-9_.:-]/', '', $code) ?? '', 0, 100),
            'provider_reason' => $reason === null ? null : $this->sanitizeReason($reason),
        ], fn ($value) => $value !== null);
    }

    private function firstScalar(array $payload, array $paths): ?string
    {
        foreach ($paths as $path) {
            $value = data_get($payload, $path);
            if (is_string($value) || is_int($value)) {
                return (string) $value;
            }
        }

        return null;
    }

    private function sanitizeReason(string $reason): string
    {
        $reason = strip_tags($reason);
        $reason = preg_replace('~https?://\S+~iu', '[redacted-url]', $reason) ?? '';
        $reason = preg_replace('/Bearer\s+\S+/iu', 'Bearer [redacted]', $reason) ?? '';
        $reason = preg_replace('/[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}/iu', '[redacted-email]', $reason) ?? '';
        $reason = preg_replace('/(?<![a-z0-9])[a-z0-9_\-]{20,}(?![a-z0-9])/iu', '[redacted-value]', $reason) ?? '';
        $reason = preg_replace('/\+?\d[\d\s().\-]{7,}\d/u', '[redacted-number]', $reason) ?? '';
        $reason = preg_replace('/[\x00-\x1F\x7F]+/u', ' ', $reason) ?? '';

        return mb_substr(trim(preg_replace('/\s+/u', ' ', $reason) ?? ''), 0, 240);
    }
}
