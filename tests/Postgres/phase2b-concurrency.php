<?php

use App\Models\InventoryItem;
use App\Models\Organization;
use App\Models\PickupLocation;
use App\Models\ReceiptChallenge;
use App\Models\User;
use App\Services\Delivery\ReceiptVerificationService;
use App\Services\SupportDistributionService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;

$processes = [];
$failed = false;
try {
    require __DIR__.'/phase2a-bootstrap.php';
    Queue::fake();
    $suffix = Str::random(8);
    $actor = User::create(['username' => 'TEST_RACE_'.$suffix, 'full_name' => 'TEST receipt race', 'password' => Str::random(32), 'role' => 'admin', 'is_active' => true, 'can_receive_notifications' => true]);
    $organization = Organization::create(['name' => 'TEST race', 'code' => 'TEST_'.$suffix, 'contact' => '0501234567', 'status' => 'active']);
    $location = PickupLocation::create(['name' => 'TEST location']);
    $stock = InventoryItem::create(['name' => 'TEST receipt race', 'unit' => 'kg', 'current_quantity' => '10.00', 'min_threshold' => '0.75']);
    $service = app(SupportDistributionService::class);
    $support = $service->create(['recipient_type' => 'organization', 'organization_id' => $organization->id, 'fulfillment_method' => 'pickup', 'pickup_location_id' => $location->id, 'items' => [['inventory_item_id' => $stock->id, 'requested_quantity' => '2.50']]], $actor->id);
    foreach (['approve', 'reserve', 'ready'] as $action) {
        $service->transition($support->id, $action, $actor->id);
    }
    app(ReceiptVerificationService::class)->issue($support->id, $actor->id);
    $challenge = ReceiptChallenge::where('support_distribution_id', $support->id)->firstOrFail();
    $code = str_pad((string) random_int(0, 9999), 4, '0', STR_PAD_LEFT);
    $challenge->update(['verifier' => hash_hmac('sha256', 'receipt:'.$support->id.':'.$challenge->generation.':'.$code, config('app.key'))]);
    DB::beginTransaction();
    DB::table('support_distributions')->where('id', $support->id)->lockForUpdate()->first();
    for ($i = 0; $i < 2; $i++) {
        $process = proc_open([PHP_BINARY, __DIR__.'/phase2b-receipt-worker.php'], [['pipe', 'r'], ['pipe', 'w'], ['pipe', 'w']], $pipes, dirname(__DIR__, 2));
        if (! is_resource($process)) {
            throw new RuntimeException('Worker unavailable');
        }
        fwrite($pipes[0], json_encode(['id' => $support->id, 'actor' => $actor->id, 'code' => $code]));
        fclose($pipes[0]);
        $processes[] = [$process, $pipes];
    }
    $deadline = microtime(true) + 15;
    do {
        DB::select('SELECT pg_stat_clear_snapshot()');
        $waiting = (int) DB::selectOne("SELECT count(*) AS n FROM pg_stat_activity WHERE application_name = 'phase2b_receipt_worker' AND wait_event_type = 'Lock'")->n;
        if ($waiting === 2) {
            break;
        }
        usleep(50000);
    } while (microtime(true) < $deadline);
    if ($waiting !== 2) {
        throw new RuntimeException('Overlap barrier not proven');
    }
    echo "PASS two real PHP processes simultaneously waiting on PostgreSQL row lock\n";
    DB::commit();
    $results = [];
    $replays = [];
    foreach ($processes as [$process,$pipes]) {
        $out = stream_get_contents($pipes[1]);
        fclose($pipes[1]);
        $error = stream_get_contents($pipes[2]);
        fclose($pipes[2]);
        $exit = proc_close($process);
        if ($exit !== 0 || ! preg_match('/RESULT=(200)/', $out, $match) || ! preg_match('/REPLAY=([01])/', $out, $replay)) {
            throw new RuntimeException('Worker result invalid');
        }
        $results[] = (int) $match[1];
        $replays[] = (int) $replay[1];
    }
    $processes = [];
    sort($results);
    sort($replays);
    if ($results !== [200, 200] || $replays !== [0, 1]) {
        throw new RuntimeException('Receipt race invariant failed');
    }
    if (DB::table('support_receipts')->where('support_distribution_id', $support->id)->count() !== 1 || DB::table('inventory_movements')->where('support_distribution_id', $support->id)->count() !== 1 || $stock->fresh()->current_quantity !== '7.50' || $stock->fresh()->reserved_quantity !== '0.00') {
        throw new RuntimeException('Completion ledger failed');
    }
    foreach (['support_completed', 'support_receipt_verified'] as $event) {
        if (DB::table('notifications')->where('recipient_id', $actor->id)->where('related_record_id', $support->id)->where('event_type', $event)->count() !== 1) {
            throw new RuntimeException('Completion notification invariant failed');
        }
    }
    echo "PASS concurrent confirmations: two 200, one replay; one receipt, one movement; one notification per completion event; current=7.50 reserved=0.00\n";
} catch (Throwable $e) {
    $failed = true;
    fwrite(STDERR, get_class($e).' line '.$e->getLine().PHP_EOL);
    if (isset($qaApp) && DB::transactionLevel()) {
        DB::rollBack();
    }
    foreach ($processes as [$process,$pipes]) {
        if (is_resource($process)) {
            proc_terminate($process);
            proc_close($process);
        }
    }
    fwrite(STDERR, "Phase 2B concurrency gate failed; sensitive exception details withheld.\n");
} finally {
    // Delete only exact IDs created by this run, after verifying the synthetic actor marker.
    if (isset($qaApp, $actor) && str_starts_with($actor->username, 'TEST_RACE_')) {
        try {
            verifyPhase2aTarget();
            DB::transaction(function () use ($actor, &$support, &$stock, &$location, &$organization) {
                if (isset($support)) {
                    $id = $support->id;
                    DB::table('notifications')->where('related_record_id', $id)->delete();
                    DB::table('communication_messages')->where('operation_id', $id)->delete();
                    DB::table('support_receipts')->where('support_distribution_id', $id)->delete();
                    DB::table('receipt_challenges')->where('support_distribution_id', $id)->delete();
                    DB::table('inventory_movements')->where('support_distribution_id', $id)->delete();
                    DB::table('support_distribution_items')->where('support_distribution_id', $id)->delete();
                    DB::table('support_distributions')->where('id', $id)->delete();
                }
                DB::table('audit_logs')->where('user_id', $actor->id)->delete();
                DB::table('notifications')->where('recipient_id', $actor->id)->delete();
                if (isset($stock)) {
                    DB::table('inventory_items')->where('id', $stock->id)->delete();
                }
                if (isset($location)) {
                    DB::table('pickup_locations')->where('id', $location->id)->delete();
                }
                if (isset($organization)) {
                    DB::table('organizations')->where('id', $organization->id)->delete();
                }
                DB::table('users')->where('id', $actor->id)->where('username', $actor->username)->delete();
            });
            echo "PASS exact-ID synthetic concurrency fixture cleanup\n";
        } catch (Throwable) {
            $failed = true;
            fwrite(STDERR, "QA synthetic fixture cleanup failed; sensitive details withheld.\n");
        }
    }
}
exit($failed ? 1 : 0);
