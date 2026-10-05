<?php

namespace App\Jobs;

use App\Models\CommunicationMessage;
use App\Services\Communications\CommunicationService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\DB;

class SendCommunication implements ShouldQueue
{
    use Queueable;

    public int $tries = 1;

    public int $timeout = 20;

    public bool $failOnTimeout = true;

    public function failed(?\Throwable $exception): void
    {
        DB::transaction(function () {
            $message = CommunicationMessage::whereKey($this->messageId)->lockForUpdate()->first();
            if (! $message || ! in_array($message->status, ['pending', 'retrying', 'sending'], true)) {
                return;
            }
            if ($message->status === 'sending') {
                // A terminated worker may have reached the provider. Never resend blindly.
                $message->fill(['status' => 'failed', 'error_code' => 'send_outcome_unknown', 'failed_at' => now(), 'next_attempt_at' => null, 'provider_diagnostics' => ['delivery_state' => 'unknown', 'reconciliation_required' => true]])->save();

                return;
            }
            if ($message->status !== 'sending') {
                $message->attempts++;
            }
            $final = $message->attempts >= config('delivery.send_max_attempts');
            $message->fill(['status' => $final ? 'failed' : 'retrying', 'error_code' => 'worker_timeout', 'failed_at' => now(), 'next_attempt_at' => $final ? null : now()->addMinutes(2)])->save();
        });
    }

    public function __construct(public string $messageId)
    {
        $this->onQueue(config('delivery.communication_queue', 'ekram-communications-v2'));
    }

    public function handle(CommunicationService $service): void
    {
        $service->send($this->messageId);
    }
}
