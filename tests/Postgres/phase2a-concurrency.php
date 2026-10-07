<?php

use App\Models\InventoryItem;
use App\Models\Organization;
use App\Models\PickupLocation;
use App\Models\User;
use App\Services\SupportDistributionService;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

try {
    require __DIR__.'/phase2a-bootstrap.php';
    $role = $argv[1] ?? 'parent';
    $folder = dirname(__DIR__, 2).'/.tmp/phase2a-evidence';
    if ($role !== 'parent') {
        [$script, $role, $run, $id, $actor, $stock] = $argv;
        DB::select("SELECT set_config('application_name', ?, false)", ['phase2a_'.$run.'_'.$role]);
        if ($role === 'A') {
            DB::beginTransaction();
            InventoryItem::whereKey($stock)->lockForUpdate()->firstOrFail();
            file_put_contents($folder.'/'.$run.'.locked', 'locked');
            $deadline = microtime(true) + 25;
            while (! is_file($folder.'/'.$run.'.release')) {
                if (microtime(true) > $deadline) {
                    throw new RuntimeException('Barrier timeout');
                }
                usleep(20000);
            }
        }
        try {
            app(SupportDistributionService::class)->transition($id, 'reserve', $actor);
            if ($role === 'A') {
                DB::commit();
            }
            $outcome = 'reserved';
        } catch (ValidationException $e) {
            $outcome = 'rejected_422';
        }
        file_put_contents($folder.'/'.$run.'.'.$role.'.json', json_encode(['pid' => getmypid(), 'outcome' => $outcome]));
        exit(0);
    }
    $run = 'race_'.bin2hex(random_bytes(5));
    $actor = User::create(['username' => $run, 'full_name' => 'TEST concurrent', 'password' => bin2hex(random_bytes(20)), 'role' => 'admin', 'is_active' => true]);
    $stock = InventoryItem::create(['name' => $run, 'unit' => 'kg', 'current_quantity' => '3.00']);
    $location = PickupLocation::create(['name' => $run]);
    $org = Organization::create(['name' => $run, 'code' => $run, 'status' => 'active']);
    $service = app(SupportDistributionService::class);
    $payload = ['recipient_type' => 'organization', 'organization_id' => $org->id, 'fulfillment_method' => 'pickup', 'pickup_location_id' => $location->id,
        'items' => [['inventory_item_id' => $stock->id, 'requested_quantity' => '2.50']]];
    $a = $service->create($payload, $actor->id);
    $b = $service->create($payload, $actor->id);
    $service->transition($a->id, 'approve', $actor->id);
    $service->transition($b->id, 'approve', $actor->id);
    $spawn = function ($role, $id) use ($run, $actor, $stock, $folder) {
        return proc_open([PHP_BINARY, __FILE__, $role, $run, $id, $actor->id, $stock->id],
            [0 => ['pipe', 'r'], 1 => ['file', $folder.'/'.$run.'.'.$role.'.log', 'w'], 2 => ['file', $folder.'/'.$run.'.'.$role.'.log', 'a']], $pipes);
    };
    $pa = $spawn('A', $a->id);
    $deadline = microtime(true) + 15;
    while (! is_file($folder.'/'.$run.'.locked')) {
        if (microtime(true) > $deadline) {
            throw new RuntimeException('Worker A did not lock');
        }
        usleep(20000);
    }
    $pb = $spawn('B', $b->id);
    $blocked = false;
    $deadline = microtime(true) + 15;
    while (microtime(true) < $deadline) {
        $row = DB::selectOne('SELECT wait_event_type FROM pg_stat_activity WHERE application_name = ?', ['phase2a_'.$run.'_B']);
        if ($row && $row->wait_event_type === 'Lock') {
            $blocked = true;
            break;
        }
        usleep(20000);
    }
    file_put_contents($folder.'/'.$run.'.release', 'release');
    $exitA = proc_close($pa);
    $exitB = proc_close($pb);
    $ra = json_decode(file_get_contents($folder.'/'.$run.'.A.json'), true);
    $rb = json_decode(file_get_contents($folder.'/'.$run.'.B.json'), true);
    $stock->refresh();
    $sum = DB::table('support_distribution_items')->whereIn('support_distribution_id', [$a->id, $b->id])->sum('reserved_quantity');
    if (! $blocked || $exitA !== 0 || $exitB !== 0 || $ra['pid'] === $rb['pid'] || $ra['outcome'] !== 'reserved' || $rb['outcome'] !== 'rejected_422'
        || (float) $sum !== 2.5 || $stock->reserved_quantity !== '2.50' || $stock->available_quantity !== '0.50') {
        throw new RuntimeException('Concurrent reservation assertion failed');
    }
    echo json_encode(['test' => 'two_process_reservation', 'result' => 'PASS', 'worker_a' => $ra, 'worker_b' => $rb,
        'postgres_lock_wait_observed' => $blocked, 'current_quantity' => $stock->current_quantity,
        'combined_reserved' => (string) $sum, 'available_quantity' => $stock->available_quantity], JSON_PRETTY_PRINT).PHP_EOL;
} catch (Throwable $e) {
    fwrite(STDERR, 'Concurrency QA failed: '.get_class($e).PHP_EOL);
    exit(1);
}
