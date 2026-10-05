<?php

use App\Jobs\SendCommunication;
use App\Models\CommunicationMessage;
use App\Services\InventoryAlertService;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('notifications:inventory', function () {
    app(InventoryAlertService::class)->scan();
    $this->info('Inventory alerts evaluated.');
})->purpose('Persist deduplicated low-stock and expiry alerts');
Schedule::command('notifications:inventory')->hourly()->withoutOverlapping()->onOneServer();

// Durable outbox recovers dispatch failures; jobs contain only message IDs.
Artisan::command('communications:drain {--since= : Approved UTC cutoff for production recovery}', function () {
    $since = $this->option('since');
    if (config('services.communications.provider') === 'taqnyat' && ! $since) {
        $this->error('Production recovery requires an approved --since cutoff; legacy intents remain quarantined.');

        return 1;
    }
    if ($since && ! preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/D', $since)) {
        $this->error('Use an approved UTC cutoff in YYYY-MM-DDTHH:MM:SSZ format.');

        return 1;
    }
    $since = $since ? CarbonImmutable::parse($since) : null;
    // A killed worker may have sent the request; quarantine instead of resending.
    CommunicationMessage::where('status', 'sending')->where('updated_at', '<=', now()->subMinutes(5))
        ->get()->each(function ($message) {
            DB::transaction(function () use ($message) {
                $locked = CommunicationMessage::whereKey($message->id)->lockForUpdate()->first();
                if ($locked?->status !== 'sending' || $locked->updated_at->gt(now()->subMinutes(5))) {
                    return;
                }
                $locked->update(['status' => 'failed', 'error_code' => 'send_outcome_unknown', 'failed_at' => now(), 'next_attempt_at' => null,
                    'provider_diagnostics' => ['delivery_state' => 'unknown', 'reconciliation_required' => true]]);
            });
        });
    CommunicationMessage::whereNotNull('encrypted_payload')->where('payload_expires_at', '<=', now())
        ->update(['encrypted_payload' => null]);
    CommunicationMessage::whereIn('status', ['pending', 'retrying'])
        ->when($since, fn ($q) => $q->where('requested_at', '>=', $since))
        ->where(fn ($q) => $q->whereNull('next_attempt_at')->orWhere('next_attempt_at', '<=', now()))
        ->orderBy('requested_at')->limit(100)->pluck('id')->each(fn ($id) => SendCommunication::dispatch($id));
})->purpose('Recover scoped communication dispatches and erase expired secret payloads');
Schedule::command('communications:drain')->everyMinute()->withoutOverlapping()->onOneServer();
