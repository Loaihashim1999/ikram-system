<?php

use App\Models\Beneficiary;
use App\Models\User;
use App\Services\Communications\CommunicationService;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;

$input = json_decode(stream_get_contents(STDIN), true, flags: JSON_THROW_ON_ERROR);
if (($input['candidate_ready'] ?? false) !== true || empty($input['expected_revision'])
    || getenv('CONTAINER_APP_REVISION') !== $input['expected_revision']) {
    throw new RuntimeException('Exact ready candidate required');
}
require '/var/www/html/vendor/autoload.php';
$app = require '/var/www/html/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
if (config('services.communications.provider') !== 'fake' || config('database.default') !== 'pgsql'
    || config('database.connections.pgsql.database') !== 'ikram_prod') {
    throw new RuntimeException('Approved fake candidate required');
}
$run = $input['run_id'] ?? '';
if (! Str::isUuid($run)) {
    throw new RuntimeException('Exact test run required');
}
$marker = 'EKRAM-E2E-TEST '.$run;
$actor = User::findOrFail($input['actor_id'] ?? '');
$recipient = Beneficiary::findOrFail($input['beneficiary_id'] ?? '');
$expectedUsername = 'EKRAM-E2E-TEST-'.substr(str_replace('-', '', $run), 0, 32);
if ($actor->username !== $expectedUsername || ! str_starts_with($actor->full_name, $marker)
    || $recipient->created_by !== $actor->id || ! str_starts_with($recipient->full_name, $marker)) {
    throw new RuntimeException('Exact test ownership required');
}
Queue::fake();
$message = DB::transaction(function () use ($run, $recipient) {
    $message = app(CommunicationService::class)->enqueue(
        'EKRAM-E2E-TEST:'.$run.':basic-sms', 'beneficiary', $recipient->id,
        'ekram_e2e_basic_sms', $run, '+966574917155',
        'EKRAM TEST - controlled SMS validation', now()->addMinutes(45), null, false,
    );
    if ($message->status !== 'pending' || $message->attempts !== 0) {
        throw new RuntimeException('Refuse already attempted message');
    }
    $message->update(['next_attempt_at' => now()->addDays(1)]);

    return $message;
});
echo json_encode(['id' => $message->id, 'status' => $message->status, 'attempts' => $message->attempts, 'held' => $message->next_attempt_at->isFuture()], JSON_THROW_ON_ERROR);
