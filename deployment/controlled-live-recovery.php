<?php

use App\Models\Beneficiary;
use App\Models\BeneficiaryPolicyVersion;
use App\Models\CommunicationMessage;
use App\Models\Driver;
use App\Models\DriverAssignment;
use App\Models\InventoryItem;
use App\Models\PickupLocation;
use App\Models\SupportDistribution;
use App\Models\User;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

// Read-only exact-run discovery and durable SMS evidence; no auth/capability output.
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
$db = DB::connection();
$db->beginTransaction();
$db->statement('SET TRANSACTION READ ONLY');
$db->statement("SET LOCAL statement_timeout='15s'");
try {
    $actorUsername = 'EKRAM-E2E-TEST-'.substr(str_replace('-', '', $run), 0, 32);
    $actor = User::where('username', $actorUsername)->first();
    if (! $actor) {
        echo json_encode(['read_only' => true, 'actor_exists' => false]);

        return;
    }
    if (! str_starts_with($actor->full_name, $marker)) {
        throw new RuntimeException('Actor marker mismatch');
    }
    $beneficiaries = Beneficiary::where('created_by', $actor->id)->get();
    foreach ($beneficiaries as $record) {
        if (! str_starts_with($record->full_name, $marker)) {
            throw new RuntimeException('Unmarked dependent beneficiary');
        }
    }
    $original = $beneficiaries->filter(fn ($record) => str_starts_with($record->full_name, $marker.' Recipient '))->pluck('id')->all();
    $additional = $beneficiaries->pluck('id')->diff($original)->values()->all();
    $tasks = SupportDistribution::where('created_by', $actor->id)->get();
    foreach ($tasks as $task) {
        if (! in_array($task->beneficiary_id, $beneficiaries->pluck('id')->all(), true)) {
            throw new RuntimeException('Foreign dependent task');
        }
    }
    $controlTasks = $tasks->filter(fn ($task) => in_array($task->notes, [$marker.' expired control', $marker.' revoked control'], true));
    $businessTasks = $tasks->reject(fn ($task) => $controlTasks->contains('id', $task->id));
    $originalTasks = $businessTasks->whereIn('beneficiary_id', $original);
    $stock = InventoryItem::where('name', $marker.' Basket')->sole();
    $driver = Driver::where('full_name', $marker.' Driver')->sole();
    $pickup = PickupLocation::where('name', $marker.' Pickup')->sole();
    $policy = BeneficiaryPolicyVersion::where('policy_name', $marker.' TEST Policy')->sole();
    $assignments = DriverAssignment::where('created_by', $actor->id)->where('driver_id', $driver->id)->get();
    $operations = array_merge($tasks->pluck('id')->all(), $assignments->pluck('id')->all(), [$run]);
    $messages = CommunicationMessage::whereIn('operation_id', $operations)->get();
    $assignment = $assignments->firstOrFail();
    $driverMessage = $messages->where('operation_id', $assignment->id)->where('operation_type', 'driver_assignment_sms')->firstOrFail();
    $manifest = ['run_id' => $run, 'marker' => $marker, 'ids' => ['actor' => $actor->id, 'inventory' => $stock->id,
        'driver' => $driver->id, 'pickup_location' => $pickup->id, 'policy' => $policy->id,
        'beneficiaries' => $original, 'delivery' => $originalTasks->where('fulfillment_method', 'delivery')->pluck('id')->all(),
        'pickup' => $originalTasks->where('fulfillment_method', 'pickup')->sole()->id, 'assignment' => $assignment->id,
        'driver_message' => $driverMessage->id, 'messages' => $messages->pluck('id')->all(), 'control_tasks' => $controlTasks->pluck('id')->all()],
        'additional_beneficiaries' => $additional, 'additional_distributions' => $businessTasks->pluck('id')->diff($originalTasks->pluck('id'))->values()->all()];
    $selectedIds = $input['message_ids'] ?? [];
    if (array_diff($selectedIds, $messages->pluck('id')->all())) {
        throw new RuntimeException('Foreign communication ID');
    }
    $selected = $messages->whereIn('id', $selectedIds);
    $queue = 'EKRAM-E2E-TEST-'.$run;
    $evidence = $selected->map(fn ($message) => ['id' => $message->id, 'status' => $message->status,
        'attempts' => $message->attempts, 'error_code' => $message->error_code,
        'provider_reference' => preg_match('/^[A-Za-z0-9_.:-]{1,100}$/D', $message->provider_reference ?? '') ? $message->provider_reference : null,
        'provider_diagnostics' => array_intersect_key($message->provider_diagnostics ?? [], array_flip(['http_status', 'provider_requests', 'acceptance_state', 'delivery_state', 'reconciliation_required', 'provider_error_class'])),
        'requested_at' => $message->requested_at?->toIso8601String(), 'sent_at' => $message->sent_at?->toIso8601String()])->values()->all();
    echo json_encode(['read_only' => true, 'actor_exists' => true, 'manifest' => $manifest, 'queue' => $queue,
        'remaining_jobs' => $db->table('jobs')->where('queue', $queue)->count(), 'messages' => $evidence,
        'provider_outcome_unknown' => $selected->contains(fn ($message) => $message->status === 'sending' || $message->error_code === 'send_outcome_unknown')], JSON_THROW_ON_ERROR);
} finally {
    $db->rollBack();
}
