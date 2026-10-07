<?php

use App\Contracts\Communications\MessageProviderInterface;
use App\Jobs\SendCommunication;
use App\Models\CommunicationMessage;
use App\Models\DriverAssignment;
use App\Models\User;
use App\Services\Communications\CommunicationService;
use App\Services\Communications\MessageTemplates;
use App\Services\Communications\SaudiPhoneNumber;
use App\Services\Communications\TaqnyatSmsProvider;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Http\Client\Response;
use Illuminate\Queue\WorkerOptions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;

// Orchestrator-only preparation. Never run without the explicit candidate READY gate.
$input = json_decode(stream_get_contents(STDIN), true, flags: JSON_THROW_ON_ERROR);
if (($input['candidate_ready'] ?? false) !== true || ($input['no_background_workers_confirmed'] ?? false) !== true || empty($input['expected_revision']) || getenv('CONTAINER_APP_REVISION') !== $input['expected_revision']) {
    throw new RuntimeException('ABORT: exact ready candidate and absent background consumers required');
}
require dirname(__DIR__, 2).'/vendor/autoload.php';
$app = require dirname(__DIR__, 2).'/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
if (config('services.communications.provider') !== 'fake' || config('database.default') !== 'pgsql' || config('database.connections.pgsql.database') !== 'ikram_prod' || config('queue.connections.database.driver') !== 'database') {
    throw new RuntimeException('ABORT: candidate fake provider and approved database queue required');
}
$run = $input['run_id'] ?? '';
$ids = $input['message_ids'] ?? [];
if (! Str::isUuid($run) || count($ids) !== 2 || count(array_unique($ids)) !== 2 || array_filter($ids, fn ($id) => ! Str::isUuid($id))) {
    throw new RuntimeException('ABORT: two exact message IDs required');
}
$queue = 'EKRAM-E2E-TEST-'.$run;
$actorId = $input['actor_id'] ?? '';
$actor = User::find($actorId);
if (! $actor || ! str_starts_with($actor->full_name, 'EKRAM-E2E-TEST '.$run)) {
    throw new RuntimeException('ABORT: marked actor required');
}
$assignmentId = $input['assignment_id'] ?? '';
$assignment = DriverAssignment::find($assignmentId);
if (! $assignment || $assignment->created_by !== $actorId) {
    throw new RuntimeException('ABORT: owned assignment required');
}
$driver = $assignment->driver;
if (! $driver || ! $driver->is_active || ! str_starts_with($driver->full_name, 'EKRAM-E2E-TEST '.$run) || $assignment->revoked_at || $assignment->completed_at || $assignment->expires_at->lte(now()->addMinutes(2))) {
    throw new RuntimeException('ABORT: marked active driver assignment required');
}
$table = config('queue.connections.database.table', 'jobs');
if (DB::table($table)->where('queue', $queue)->exists()) {
    throw new RuntimeException('ABORT: run queue already exists; never replay');
}

$keys = [];
$messages = CommunicationMessage::whereIn('id', $ids)->get();
if ($messages->count() !== 2) {
    throw new RuntimeException('ABORT: missing intent');
}
foreach ($messages as $message) {
    $payload = $message->encrypted_payload;
    $isDriver = $message->operation_type === 'driver_assignment_sms' && $message->operation_id === $assignmentId;
    $isBasic = $message->operation_id === $run && $message->operation_type === 'ekram_e2e_basic_sms' && $message->idempotency_key === 'EKRAM-E2E-TEST:'.$run.':basic-sms';
    if (! $isDriver && ! $isBasic) {
        throw new RuntimeException('ABORT: basic run intent or owned driver intent required');
    }
    if ($isBasic && ($payload['body'] ?? '') !== 'EKRAM TEST - controlled SMS validation') {
        throw new RuntimeException('ABORT: exact harmless basic body required');
    }
    if ($isDriver) {
        $body = $payload['body'] ?? '';
        if (! preg_match('/driver-access#([a-f0-9]{64})/', $body, $match) || ! hash_equals($assignment->token_hash, hash('sha256', $match[1]))) {
            throw new RuntimeException('ABORT: owned driver capability required');
        }
        $expectedBody = app(MessageTemplates::class)->render('driver_assignment_sms', ['driver_name' => $driver->full_name, 'temporary_driver_link' => rtrim(config('app.url'), '/').'/driver-access#'.$match[1], 'link_expiry' => $assignment->expires_at->format('Y-m-d H:i')]);
        if (! hash_equals($expectedBody, $body)) {
            throw new RuntimeException('ABORT: canonical driver message required');
        }
    }
    if ($message->channel !== 'sms' || $message->status !== 'pending' || $message->attempts !== 0 || ! $message->next_attempt_at?->isFuture() || $message->payload_expires_at->lte(now()->addMinutes(2)) || app(SaudiPhoneNumber::class)->normalize($payload['destination'] ?? null) !== '966574917155') {
        throw new RuntimeException('ABORT: scoped unused held intent required');
    }
    $keys[$message->idempotency_key] = $message->id;
}
if ($messages->where('operation_type', 'driver_assignment_sms')->count() !== 1) {
    throw new RuntimeException('ABORT: exactly one driver intent required');
}
if (count($keys) !== 2) {
    throw new RuntimeException('ABORT: distinct idempotency keys required');
}

$taqnyat = new class(app(SaudiPhoneNumber::class)) extends TaqnyatSmsProvider
{
    private ?int $status = null;

    protected function post(string $tokenKey, string $url, array $payload): Response
    {
        $this->status = null;
        $response = parent::post($tokenKey, $url, $payload);
        $this->status = $response->status();

        return $response;
    }

    public function lastHttpStatus(): ?int
    {
        return $this->status;
    }
};
$provider = new class($keys, $taqnyat) implements MessageProviderInterface
{
    public array $requested = [];

    public function __construct(private array $keys, private TaqnyatSmsProvider $taqnyat) {}

    public function send(string $idempotencyKey, array $payload): string
    {
        if (! isset($this->keys[$idempotencyKey]) || isset($this->requested[$idempotencyKey]) || count($this->requested) >= 2 || app(SaudiPhoneNumber::class)->normalize($payload['destination'] ?? null) !== '966574917155' || DB::transactionLevel() !== 0) {
            throw new RuntimeException('Scoped provider guard refused');
        }
        // Set before HTTP: even an ambiguous result cannot trigger another call.
        $this->requested[$idempotencyKey] = true;

        return $this->taqnyat->send($idempotencyKey, $payload);
    }

    public function lastHttpStatus(): ?int
    {
        return $this->taqnyat->lastHttpStatus();
    }
};
$adapter = new class($ids, $provider) extends CommunicationService
{
    public function __construct(private array $ids, private MessageProviderInterface $provider) {}

    public function send(string $id): void
    {
        if (! in_array($id, $this->ids, true)) {
            throw new RuntimeException('Unexpected job refused');
        }
        $this->sendOnce($id, $this->provider);
    }
};
$app->instance(CommunicationService::class, $adapter);
// Short producer transaction only; provider HTTP is outside every transaction.
DB::transaction(function () use ($ids, $queue) {
    foreach ($ids as $id) {
        $message = CommunicationMessage::whereKey($id)->lockForUpdate()->firstOrFail();
        if ($message->status !== 'pending' || $message->attempts !== 0 || ! $message->next_attempt_at?->isFuture()) {
            throw new RuntimeException('ABORT: intent changed');
        }
        $message->update(['next_attempt_at' => null]);
        Queue::connection('database')->push((new SendCommunication($id))->onConnection('database')->onQueue($queue), '', $queue);
    }
});
$queued = DB::table($table)->where('queue', $queue)->get();
if ($queued->count() !== 2) {
    throw new RuntimeException('ABORT: exact two queued jobs required');
}
foreach ($queued as $job) {
    $payload = json_decode($job->payload, true, flags: JSON_THROW_ON_ERROR);
    if (($payload['displayName'] ?? null) !== SendCommunication::class || ! array_filter($ids, fn ($id) => str_contains($payload['data']['command'] ?? '', $id))) {
        throw new RuntimeException('ABORT: unexpected queue payload');
    }
}
// Same PHP process retains the scoped binding; no general worker is launched.
$worker = $app->make('queue.worker');
$exit = $worker->daemon('database', $queue, new WorkerOptions(name: $queue, sleep: 0, maxTries: 1, stopWhenEmpty: true, maxJobs: 2, maxTime: 55));
$finalMessages = CommunicationMessage::whereIn('id', $ids)->get();
foreach ($finalMessages as $message) {
    if (in_array($message->error_code, ['send_outcome_unknown', 'provider_timeout'], true) && ($message->status !== 'failed' || $message->next_attempt_at !== null)) {
        throw new RuntimeException('ABORT: ambiguous intent must be final with no automated retry');
    }
}
$results = $finalMessages->map(fn ($m) => ['id' => $m->id, 'status' => $m->status, 'attempts' => $m->attempts, 'error_code' => $m->error_code, 'provider_reference' => substr(preg_replace('/[^A-Za-z0-9_.:-]/', '', (string) $m->provider_reference), 0, 100), 'http_status' => $m->provider_diagnostics['http_status'] ?? null, 'requested_at' => $m->requested_at?->toIso8601String(), 'sent_at' => $m->sent_at?->toIso8601String(), 'acceptance_state' => $m->provider_diagnostics['acceptance_state'] ?? null, 'delivery_state' => $m->provider_diagnostics['delivery_state'] ?? null, 'no_automatic_retry' => $m->next_attempt_at === null && in_array($m->status, ['sent', 'failed'], true)])->all();
echo json_encode(['queue' => $queue, 'job_ids' => $queued->pluck('id')->all(), 'worker_exit' => $exit, 'provider_calls' => count($provider->requested), 'remaining_jobs' => DB::table($table)->where('queue', $queue)->count(), 'messages' => $results], JSON_THROW_ON_ERROR);
