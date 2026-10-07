<?php

use App\Contracts\Communications\SmsProviderInterface;
use App\Models\CommunicationMessage;
use App\Models\Driver;
use App\Models\DriverAssignment;
use App\Models\InventoryItem;
use App\Models\Organization;
use App\Models\User;
use App\Services\Communications\FakeSmsProvider;
use App\Services\Delivery\DriverAccessService;
use App\Services\SupportDistributionService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;

$processes = [];
$failed = false;
$actor = null;
$supportIds = [];
$driverIds = [];
$assignmentIds = [];
$stock = null;
$organization = null;

function tokenFrom(CommunicationMessage $message): string
{
    if (! preg_match('/driver-access#([a-f0-9]{64})/', (string) ($message->encrypted_payload['body'] ?? ''), $match)) {
        throw new RuntimeException('Capability marker missing');
    }

    return $match[1];
}

try {
    require __DIR__.'/phase2a-bootstrap.php';
    config(['services.communications.provider' => 'fake']);
    app()->bind(SmsProviderInterface::class, FakeSmsProvider::class);
    Queue::fake();
    $suffix = Str::lower(Str::random(8));
    $actor = User::create(['username' => 'TEST_REASSIGN_RACE_'.$suffix, 'full_name' => 'TEST reassignment race', 'password' => Str::random(32), 'role' => 'admin', 'is_active' => true, 'can_receive_notifications' => false]);
    $organization = Organization::create(['name' => 'TEST reassignment race', 'code' => 'TEST_RR_'.$suffix, 'contact' => '0500000100', 'status' => 'active']);
    $stock = InventoryItem::create(['name' => 'TEST reassignment race item', 'unit' => 'kg', 'current_quantity' => '100.00', 'min_threshold' => '1.00']);
    $original = Driver::create(['full_name' => 'TEST Original Driver', 'phone' => '0500000101', 'is_active' => true]);
    $first = Driver::create(['full_name' => 'TEST Replacement One', 'phone' => '0500000102', 'is_active' => true]);
    $second = Driver::create(['full_name' => 'TEST Replacement Two', 'phone' => '0500000103', 'is_active' => true]);
    $driverIds = [$original->id, $first->id, $second->id];
    $service = app(SupportDistributionService::class);
    $make = function (string $name) use ($service, $organization, $stock, $actor) {
        $support = $service->create(['recipient_type' => 'organization', 'organization_id' => $organization->id, 'fulfillment_method' => 'delivery', 'items' => [['inventory_item_id' => $stock->id, 'requested_quantity' => '1.00']]], $actor->id);
        $support->update(['recipient_name' => $name]);
        foreach (['approve', 'reserve', 'ready'] as $action) {
            $support = $service->transition($support->id, $action, $actor->id);
        }

        return $support;
    };
    $moved = $make('TEST MOVED');
    $sibling = $make('TEST SIBLING');
    $supportIds = [$moved->id, $sibling->id];
    $initial = app(DriverAccessService::class)->assign($original->id, $supportIds, 60, $actor->id);
    $assignmentIds[] = $initial->id;
    $reservedBefore = $stock->fresh()->reserved_quantity;
    $currentBefore = $stock->fresh()->current_quantity;
    $originalToken = tokenFrom(CommunicationMessage::where('operation_id', $initial->id)->firstOrFail());
    DB::beginTransaction();
    DB::table('support_distributions')->where('id', $moved->id)->lockForUpdate()->first();
    foreach ([$first->id, $second->id] as $driverId) {
        $process = proc_open([PHP_BINARY, __DIR__.'/reassign-concurrency-worker.php'], [['pipe', 'r'], ['pipe', 'w'], ['pipe', 'w']], $pipes, dirname(__DIR__, 2));
        if (! is_resource($process)) {
            throw new RuntimeException('Worker unavailable');
        }
        fwrite($pipes[0], json_encode(['driver_id' => $driverId, 'task_id' => $moved->id, 'actor' => $actor->id]));
        fclose($pipes[0]);
        $processes[] = [$process, $pipes];
    }
    $deadline = microtime(true) + 15;
    $waiting = 0;
    do {
        DB::select('SELECT pg_stat_clear_snapshot()');
        $waiting = (int) DB::selectOne("SELECT count(*) AS n FROM pg_stat_activity WHERE application_name = 'ekram_reassign_worker' AND wait_event_type = 'Lock'")->n;
        if ($waiting === 2) {
            break;
        }
        usleep(50000);
    } while (microtime(true) < $deadline);
    if ($waiting !== 2) {
        throw new RuntimeException('Overlap barrier not proven');
    }
    echo "PASS two reassignment processes waiting on the same PostgreSQL task lock\n";
    DB::commit();
    $results = [];
    foreach ($processes as [$process, $pipes]) {
        $out = stream_get_contents($pipes[1]);
        fclose($pipes[1]);
        fclose($pipes[2]);
        $exit = proc_close($process);
        if ($exit !== 0 || ! preg_match('/RESULT=ok/', $out) || ! preg_match('/ASSIGNMENT=([0-9a-f-]{36})/', $out, $match)) {
            throw new RuntimeException('Reassignment worker result invalid');
        }
        $results[] = $match[1];
        $assignmentIds[] = $match[1];
    }
    $processes = [];
    $active = DB::table('driver_assignment_tasks')->where('support_distribution_id', $moved->id)->whereNull('released_at')->get();
    $released = DB::table('driver_assignment_tasks')->where('support_distribution_id', $moved->id)->whereNotNull('released_at')->get();
    if ($active->count() !== 1 || $released->count() !== 2 || count(array_unique($results)) !== 2) {
        throw new RuntimeException('Active membership invariant failed');
    }
    $winnerId = $active->first()->driver_assignment_id;
    $winner = DriverAssignment::findOrFail($winnerId);
    if ($moved->fresh()->driver_id !== $winner->driver_id || $sibling->fresh()->driver_id !== $original->id) {
        throw new RuntimeException('Task attribution invariant failed');
    }
    if ($initial->fresh()->revoked_at !== null || DB::table('driver_assignment_tasks')->where('driver_assignment_id', $initial->id)->where('support_distribution_id', $sibling->id)->whereNull('released_at')->doesntExist()) {
        throw new RuntimeException('Sibling membership was not preserved');
    }
    $originalReleased = DB::table('driver_assignment_tasks')->where('driver_assignment_id', $initial->id)->where('support_distribution_id', $moved->id)->first();
    if ($originalReleased?->released_at === null) {
        throw new RuntimeException('Original membership was not retained as released');
    }
    $access = app(DriverAccessService::class);
    $previousMoved = $access->access($originalToken, $moved->id);
    $previousList = $access->access($originalToken);
    $winnerToken = tokenFrom(CommunicationMessage::where('operation_id', $winnerId)->where('status', 'pending')->firstOrFail());
    $winnerList = $access->access($winnerToken);
    $loserId = collect($results)->first(fn ($id) => $id !== $winnerId);
    $loser = DriverAssignment::findOrFail($loserId);
    $loserMessage = CommunicationMessage::where('operation_id', $loserId)->first();
    $siblingVisible = collect($previousList['data']['tasks'] ?? [])->pluck('reference')->all();
    $winnerVisible = collect($winnerList['data']['tasks'] ?? [])->pluck('reference')->all();
    if ($previousMoved['status'] !== 404 || $previousList['status'] !== 200 || $siblingVisible !== [$sibling->id] || $winnerList['status'] !== 200 || $winnerVisible !== [$moved->id] || $loser->revoked_at === null || $loserMessage?->status !== 'cancelled' || $loserMessage?->encrypted_payload !== null) {
        throw new RuntimeException('Capability visibility invariant failed');
    }
    if (DB::table('support_receipts')->whereIn('support_distribution_id', $supportIds)->count() !== 0
        || DB::table('inventory_movements')->whereIn('support_distribution_id', $supportIds)->count() !== 0
        || $stock->fresh()->current_quantity !== $currentBefore
        || $stock->fresh()->reserved_quantity !== $reservedBefore) {
        throw new RuntimeException('Inventory invariant failed');
    }
    echo "PASS last committed reassignment owns the only active membership; released history and the sibling remain; stock unchanged\n";
} catch (Throwable $e) {
    $failed = true;
    fwrite(STDERR, get_class($e).' line '.$e->getLine().PHP_EOL);
    if (isset($qaApp) && DB::transactionLevel()) {
        DB::rollBack();
    }
    foreach ($processes as [$process, $pipes]) {
        if (is_resource($process)) {
            proc_terminate($process);
            proc_close($process);
        }
    }
    fwrite(STDERR, "Reassignment concurrency gate failed; sensitive exception details withheld.\n");
} finally {
    if ($actor && str_starts_with($actor->username, 'TEST_REASSIGN_RACE_')) {
        try {
            verifyPhase2aTarget();
            $assignmentIds = array_values(array_unique(array_merge($assignmentIds, DB::table('driver_assignments')->where('created_by', $actor->id)->pluck('id')->all())));
            DB::transaction(function () use ($actor, $supportIds, $driverIds, $assignmentIds, $stock, $organization) {
                if ($assignmentIds) {
                    DB::table('communication_messages')->whereIn('operation_id', $assignmentIds)->delete();
                    DB::table('driver_assignment_tasks')->whereIn('driver_assignment_id', $assignmentIds)->delete();
                    DB::table('audit_logs')->whereIn('target_id', $assignmentIds)->delete();
                    DB::table('driver_assignments')->whereIn('id', $assignmentIds)->delete();
                }
                if ($supportIds) {
                    DB::table('notifications')->whereIn('related_record_id', $supportIds)->delete();
                    DB::table('communication_messages')->whereIn('operation_id', $supportIds)->delete();
                    DB::table('support_receipts')->whereIn('support_distribution_id', $supportIds)->delete();
                    DB::table('receipt_challenges')->whereIn('support_distribution_id', $supportIds)->delete();
                    DB::table('inventory_movements')->whereIn('support_distribution_id', $supportIds)->delete();
                    DB::table('support_distribution_items')->whereIn('support_distribution_id', $supportIds)->delete();
                    DB::table('audit_logs')->whereIn('target_id', $supportIds)->delete();
                    DB::table('support_distributions')->whereIn('id', $supportIds)->delete();
                }
                DB::table('audit_logs')->where('user_id', $actor->id)->delete();
                DB::table('notifications')->where('recipient_id', $actor->id)->delete();
                if ($driverIds) {
                    DB::table('drivers')->whereIn('id', $driverIds)->delete();
                }
                if ($stock) {
                    DB::table('inventory_items')->where('id', $stock->id)->delete();
                }
                if ($organization) {
                    DB::table('organizations')->where('id', $organization->id)->delete();
                }
                DB::table('users')->where('id', $actor->id)->where('username', $actor->username)->delete();
            });
            echo "PASS exact-ID synthetic reassignment fixture cleanup\n";
        } catch (Throwable) {
            $failed = true;
            fwrite(STDERR, "QA synthetic fixture cleanup failed; sensitive details withheld.\n");
        }
    }
}
exit($failed ? 1 : 0);
