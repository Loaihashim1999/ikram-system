<?php

namespace App\Services\Communications;

use App\Contracts\Communications\EmailProviderInterface;
use App\Contracts\Communications\MessageProviderInterface;
use App\Contracts\Communications\SmsProviderInterface;
use App\Jobs\SendCommunication;
use App\Models\CommunicationMessage;
use App\Services\NotificationService;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CommunicationService
{
    public function enqueue(string $key, string $type, string $reference, string $operationType, string $operationId, string $destination, string $body, CarbonInterface $expires, ?string $subject = null, bool $dispatch = true): CommunicationMessage
    {
        $channel = match ($type) {
            'beneficiary', 'staff', 'organization', 'driver' => 'sms', 'account' => 'email',
            default => throw ValidationException::withMessages(['recipient' => 'نوع مستلم غير مدعوم.']),
        };
        if ($channel !== 'email') {
            $destination = app(SaudiPhoneNumber::class)->normalize($destination);
        }
        if ($channel === 'email' && ! filter_var($destination, FILTER_VALIDATE_EMAIL)) {
            throw ValidationException::withMessages(['destination' => 'بيانات التواصل غير مكتملة أو غير صالحة.']);
        }
        $message = CommunicationMessage::firstOrCreate(['idempotency_key' => $key], [
            'channel' => $channel, 'operation_type' => $operationType, 'operation_id' => $operationId,
            'recipient_type' => $type, 'recipient_reference' => $reference,
            'destination' => '***'.substr($destination, -3),
            'encrypted_payload' => ['destination' => $destination, 'body' => $body, 'subject' => $subject],
            'payload_expires_at' => $expires, 'requested_at' => now(),
        ]);
        // Repeating an action must not migrate a legacy intent into the new queue.
        // Dispatch recovery belongs to the explicitly scoped outbox drain.
        if (! $message->wasRecentlyCreated) {
            return $message;
        }
        $id = $message->id;
        DB::afterCommit(function () use ($id, $dispatch) {
            if (! $dispatch) {
                return;
            }
            try {
                SendCommunication::dispatch($id);
            } catch (\Throwable) {
                // Durable outbox remains pending. The scheduled drain retries dispatch.
                // Do not log transport exceptions which can contain secret payloads.
            }
        });

        return $message;
    }

    public function send(string $id): void
    {
        $this->sendWithProvider($id);
    }

    public function sendOnce(string $id, MessageProviderInterface $provider): void
    {
        $this->sendWithProvider($id, $provider, true);
    }

    private function sendWithProvider(string $id, ?MessageProviderInterface $provider = null, bool $forceFinal = false): void
    {
        $claimed = DB::transaction(function () use ($id) {
            $message = CommunicationMessage::whereKey($id)->lockForUpdate()->firstOrFail();
            if (! in_array($message->status, ['pending', 'retrying'], true)) {
                return null;
            }
            if ($message->next_attempt_at?->isFuture()) {
                return null;
            }
            if ($message->payload_expires_at->lte(now()) || ! $message->encrypted_payload) {
                $message->update(['status' => 'failed', 'error_code' => 'payload_expired', 'failed_at' => now(), 'encrypted_payload' => null]);

                return null;
            }
            $message->attempts++;
            $message->fill(['status' => 'sending', 'next_attempt_at' => null])->save();

            return [
                'attempt' => $message->attempts,
                'channel' => $message->channel,
                'recipient_reference' => $message->recipient_reference,
                'key' => $message->idempotency_key,
                'payload' => $message->encrypted_payload,
            ];
        });
        if (! $claimed) {
            return;
        }

        try {
            $provider ??= app(match ($claimed['channel']) {
                'sms' => SmsProviderInterface::class, 'email' => EmailProviderInterface::class,
            });
            $reference = $provider->send($claimed['key'], $claimed['payload']);
            $httpStatus = method_exists($provider, 'lastHttpStatus') ? $provider->lastHttpStatus() : null;
            DB::transaction(function () use ($id, $claimed, $reference, $httpStatus) {
                $message = CommunicationMessage::whereKey($id)->lockForUpdate()->firstOrFail();
                if ($message->status === 'sending' && $message->attempts === $claimed['attempt']) {
                    $message->update(['status' => 'sent', 'sent_at' => now(), 'provider_reference' => $reference, 'error_code' => null, 'provider_diagnostics' => array_filter(['http_status' => $httpStatus, 'provider_requests' => 1, 'acceptance_state' => 'provider_accepted', 'delivery_state' => 'unconfirmed'], fn ($value) => $value !== null), 'encrypted_payload' => null, 'next_attempt_at' => null, 'failed_at' => null]);
                }
            });
        } catch (ProviderFailure $failure) {
            $diagnostics = $forceFinal ? array_merge($failure->diagnostics, ['provider_requests' => 1]) : $failure->diagnostics;
            $this->recordFailure($id, $claimed['attempt'], $failure->category, $failure->retryable, $diagnostics, $forceFinal);
        } catch (\Throwable) {
            $this->recordFailure($id, $claimed['attempt'], 'send_outcome_unknown', false, $forceFinal ? ['provider_requests' => 1] : [], $forceFinal);
        }
    }

    private function recordFailure(string $id, int $attempt, string $category, bool $retryable, array $diagnostics = [], bool $forceFinal = false): void
    {
        DB::transaction(function () use ($id, $attempt, $category, $retryable, $diagnostics, $forceFinal) {
            $message = CommunicationMessage::whereKey($id)->lockForUpdate()->firstOrFail();
            if ($message->status !== 'sending' || $message->attempts !== $attempt) {
                return;
            }
            // A POST may have been accepted before a timeout, 5xx or unusable
            // success response. None proves non-submission; quarantine it.
            $ambiguous = in_array($category, ['provider_timeout', 'provider_temporary', 'provider_malformed_response', 'send_outcome_unknown'], true);
            if ($ambiguous) {
                $category = 'send_outcome_unknown';
                $diagnostics['delivery_state'] = 'unknown';
                $diagnostics['reconciliation_required'] = true;
            }
            $final = $ambiguous || $forceFinal || ! $retryable || $attempt >= config('delivery.send_max_attempts', 3);
            $backoff = config('delivery.send_backoff_seconds', [30, 120, 600]);
            $seconds = $backoff[min($attempt - 1, count($backoff) - 1)] ?? 600;
            $message->update([
                'status' => $final ? 'failed' : 'retrying',
                'error_code' => $category,
                'provider_diagnostics' => array_merge(['provider_error_class' => $category], $diagnostics),
                'failed_at' => now(),
                'next_attempt_at' => $final ? null : now()->addSeconds($seconds),
            ]);
            DB::afterCommit(fn () => NotificationService::notifyAll('support_communication_failed', 'تعذر إرسال رسالة؛ راجع سجل الاتصالات.'));
        });
    }

    public function retry(string $id): void
    {
        DB::transaction(function () use ($id) {
            $message = CommunicationMessage::whereKey($id)->lockForUpdate()->firstOrFail();
            if ($message->provider_reference !== null || ($message->provider_diagnostics['reconciliation_required'] ?? false)
                || in_array($message->error_code, ['send_outcome_unknown', 'provider_timeout', 'provider_temporary', 'provider_malformed_response'], true)
                || $message->status !== 'failed' || ! $message->encrypted_payload || $message->payload_expires_at->lte(now()) || $message->attempts >= 6) {
                throw ValidationException::withMessages(['message' => 'إعادة المحاولة غير متاحة؛ انتهت الصلاحية أو حد المحاولات.']);
            }
            $message->update(['status' => 'pending', 'next_attempt_at' => null]);
            DB::afterCommit(fn () => SendCommunication::dispatch($id));
        });
    }
}
