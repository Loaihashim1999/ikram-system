<?php

use App\Models\SupportDistribution;
use App\Models\SupportReceipt;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;

$input = json_decode(stream_get_contents(STDIN), true, flags: JSON_THROW_ON_ERROR);
if (($input['candidate_ready'] ?? false) !== true || empty($input['expected_revision']) || getenv('CONTAINER_APP_REVISION') !== $input['expected_revision']) {
    throw new RuntimeException('ABORT: exact ready candidate required');
}
require dirname(__DIR__, 2).'/vendor/autoload.php';
$app = require dirname(__DIR__, 2).'/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
if (config('services.communications.provider') !== 'fake' || config('database.default') !== 'pgsql' || config('database.connections.pgsql.database') !== 'ikram_prod') {
    throw new RuntimeException('ABORT: approved candidate environment required');
}
$manifest = $input['manifest'];
$ids = $manifest['ids'];
$marker = 'EKRAM-E2E-TEST '.$manifest['run_id'];
DB::beginTransaction();
DB::statement('SET TRANSACTION READ ONLY');
DB::statement("SET LOCAL statement_timeout = '15s'");
try {
    $actor = DB::table('users')->where('id', $ids['actor'])->first();
    if (! $actor || ! str_starts_with($actor->full_name, $marker)) {
        throw new RuntimeException('ABORT: synthetic actor mismatch');
    }
    $taskIds = array_merge($ids['delivery'], [$ids['pickup']]);
    $tasks = DB::table('support_distributions')->whereIn('id', $taskIds)->get();
    if ($tasks->count() !== count($taskIds) || $tasks->contains(fn ($task) => $task->created_by !== $ids['actor'])) {
        throw new RuntimeException('ABORT: synthetic task mismatch');
    }
    $stock = DB::table('inventory_items')->where('id', $ids['inventory'])->first();
    if (! $stock || ! str_starts_with($stock->name, $marker)) {
        throw new RuntimeException('ABORT: synthetic stock mismatch');
    }
    $receipts = SupportReceipt::whereIn('support_distribution_id', $taskIds)->get();
    $snapshots = [];
    foreach ($receipts as $receipt) {
        $snapshot = $receipt->proof_snapshot;
        $task = $tasks->firstWhere('id', $receipt->support_distribution_id);
        $snapshots[$receipt->support_distribution_id] = [
            'hash' => hash('sha256', json_encode($snapshot)), 'task_matches' => ($snapshot['task_reference'] ?? null) === $task->id,
            'synthetic_recipient' => str_starts_with($snapshot['recipient']['display_name'] ?? '', $marker),
            'contact_snapshot_present' => ! empty($snapshot['recipient']['phone']) && ! empty($snapshot['recipient']['address']),
            'support_items_present' => ! empty($snapshot['items']), 'verification_recorded' => ($snapshot['verification_method'] ?? null) === 'receipt_code',
            'timestamp_recorded' => ! empty($snapshot['confirmed_at']), 'completed_recorded' => ($snapshot['final_status'] ?? null) === 'completed',
            'driver_matches' => $task->fulfillment_method === 'pickup' ? ($snapshot['driver'] ?? null) === null : ($snapshot['driver']['id'] ?? null) === $ids['driver'],
        ];
    }
    $movementCounts = DB::table('inventory_movements')->whereIn('support_distribution_id', $taskIds)->where('type', 'out')->selectRaw('support_distribution_id, count(*) AS count')->groupBy('support_distribution_id')->pluck('count', 'support_distribution_id')->all();
    $auditCounts = DB::table('audit_logs')->whereIn('target_id', $taskIds)->where('action', 'RECEIPT_VERIFIED')->selectRaw('target_id, count(*) AS count')->groupBy('target_id')->pluck('count', 'target_id')->all();
    $notificationCounts = DB::table('notifications')->whereIn('related_record_id', $taskIds)->where('recipient_id', $ids['actor'])->where('event_type', 'support_receipt_verified')->selectRaw('related_record_id, count(*) AS count')->groupBy('related_record_id')->pluck('count', 'related_record_id')->all();
    $completed = $tasks->where('status', 'completed')->count();
    $counts = ['completed_tasks' => $completed, 'receipts' => $receipts->count(), 'stock_quantity' => number_format((float) $stock->current_quantity, 2, '.', ''), 'reserved_quantity' => number_format((float) $stock->reserved_quantity, 2, '.', ''), 'movement_counts' => $movementCounts, 'verification_audit_counts' => $auditCounts, 'success_notification_counts' => $notificationCounts, 'snapshots' => $snapshots];
    $completedIds = $tasks->where('status', 'completed')->pluck('id')->all();
    sort($completedIds);
    $exactKeys = function (array $rows) use ($completedIds): bool {
        $keys = array_keys($rows);
        sort($keys);

        return $keys === $completedIds;
    };
    $evidenceComplete = true;
    foreach ([$movementCounts, $auditCounts, $notificationCounts] as $evidence) {
        $evidenceComplete = $evidenceComplete && count($evidence) === $completed && $exactKeys($evidence) && ! array_filter($evidence, fn ($count) => (int) $count !== 1);
    }
    $snapshotsValid = count($snapshots) === $completed && $exactKeys($snapshots);
    foreach ($snapshots as $snapshot) {
        $snapshotsValid = $snapshotsValid && is_string($snapshot['hash']) && preg_match('/^[a-f0-9]{64}$/D', $snapshot['hash']) === 1;
        foreach ($snapshot as $key => $value) {
            if ($key !== 'hash' && $value !== true) {
                $snapshotsValid = false;
            }
        }
    }
    $allCompleted = count($taskIds) === 3 && $completed === 3 && (float) $stock->current_quantity === 17.0 && (float) $stock->reserved_quantity === 0.0;
    $once = $receipts->count() === $completed && (float) $stock->current_quantity === 20.0 - $completed && $evidenceComplete && $snapshotsValid;
    $baseline = $input['baseline'] ?? null;
    $connected = [];
    foreach ($manifest['additional_distributions'] ?? [] as $id) {
        $task = SupportDistribution::findOrFail($id);
        if ($task->created_by !== $ids['actor'] || ! in_array($task->beneficiary_id, $manifest['additional_beneficiaries'] ?? [], true)) {
            throw new RuntimeException('ABORT: connected journey ownership mismatch');
        }
        $connected[$id] = ['api_beneficiary' => true, 'delivery' => $task->fulfillment_method === 'delivery', 'cancelled' => $task->status === 'cancelled', 'evaluation_exists' => DB::table('beneficiary_policy_evaluations')->where('beneficiary_id', $task->beneficiary_id)->where('policy_version_id', $ids['policy'])->exists(), 'items_use_test_stock' => $task->items()->where('inventory_item_id', $ids['inventory'])->exists(), 'audit_count' => DB::table('audit_logs')->where('target_id', $id)->count(), 'notification_count' => DB::table('notifications')->where('related_record_id', $id)->where('recipient_id', $ids['actor'])->count(), 'no_receipt' => ! DB::table('support_receipts')->where('support_distribution_id', $id)->exists()];
    }
    $counts['connected_api_journey'] = $connected;
    $connectedValid = count($connected) === 1;
    foreach ($connected as $entry) {
        foreach ($entry as $key => $value) {
            if (in_array($key, ['audit_count', 'notification_count'], true)) {
                $connectedValid = $connectedValid && $value >= 5;
            } else {
                $connectedValid = $connectedValid && $value === true;
            }
        }
    }
    echo json_encode(['read_only' => true, 'counts' => $counts, 'atomic_once' => $once, 'snapshots_valid' => $snapshotsValid, 'connected_api_journey_valid' => $connectedValid, 'replay_matches_baseline' => $baseline === null ? null : $counts === $baseline, 'all_expected_completed' => $allCompleted], JSON_THROW_ON_ERROR);
} finally {
    DB::rollBack();
}
