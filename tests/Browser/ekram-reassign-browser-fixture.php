<?php

use App\Models\CommunicationMessage;
use App\Models\Driver;
use App\Models\DriverAssignment;
use App\Models\InventoryItem;
use App\Models\Organization;
use App\Models\SupportDistribution;
use App\Models\User;
use App\Services\Delivery\DriverAccessService;
use App\Services\SupportDistributionService;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;

require dirname(__DIR__, 2).'/vendor/autoload.php';

$root = dirname(__DIR__, 2);
$database = $root.DIRECTORY_SEPARATOR.'.tmp'.DIRECTORY_SEPARATOR.'ekram-browser-reassign.sqlite';
$app = require $root.'/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
$connection = config('database.connections.'.config('database.default'));
$resolved = str_replace(['/', '\\'], DIRECTORY_SEPARATOR, (string) ($connection['database'] ?? ''));
$expected = str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $database);
if (config('database.default') !== 'sqlite' || strcasecmp($resolved, $expected) !== 0 || ! empty($connection['url'])) {
    fwrite(STDERR, "ABORT: browser fixture database is not the isolated sqlite file.\n");
    exit(1);
}
if (config('services.communications.provider') !== 'fake') {
    fwrite(STDERR, "ABORT: browser fixture requires the fake communication provider.\n");
    exit(1);
}

$authFile = $root.DIRECTORY_SEPARATOR.'.tmp'.DIRECTORY_SEPARATOR.'ekram-browser-auth.json';
$mode = $argv[1] ?? 'seed';

if ($mode === 'capabilities') {
    Queue::fake();
    $admin = User::where('username', 'EKRAM-BROWSER-ADMIN')->firstOrFail();
    $access = app(DriverAccessService::class);
    foreach (['EKRAM-BROWSER ORIGINAL', 'EKRAM-BROWSER REPLACEMENT'] as $name) {
        $driver = Driver::where('full_name', $name)->firstOrFail();
        $assignment = DriverAssignment::where('driver_id', $driver->id)
            ->whereNull('revoked_at')->whereNull('completed_at')
            ->whereHas('tasks', fn ($query) => $query->where('status', 'in_delivery'))
            ->firstOrFail();
        $access->resend($assignment->id, 60, $admin->id);
    }
    $mode = 'inspect';
}

if ($mode === 'inspect') {
    $moved = SupportDistribution::where('recipient_name', 'EKRAM-BROWSER MOVED')->first();
    $sibling = SupportDistribution::where('recipient_name', 'EKRAM-BROWSER SIBLING')->first();
    $capabilities = [];
    foreach (['original' => 'EKRAM-BROWSER ORIGINAL', 'replacement' => 'EKRAM-BROWSER REPLACEMENT'] as $key => $name) {
        $driver = Driver::where('full_name', $name)->first();
        $assignment = $driver ? DriverAssignment::where('driver_id', $driver->id)->whereNull('revoked_at')->whereNull('completed_at')->whereHas('tasks', fn ($query) => $query->where('status', 'in_delivery'))->latest()->first() : null;
        $message = $assignment
            ? CommunicationMessage::where('operation_id', $assignment->id)->whereNotNull('encrypted_payload')->latest()->first()
            : null;
        $token = null;
        if ($message && preg_match('/driver-access#([a-f0-9]{64})/', (string) ($message->encrypted_payload['body'] ?? ''), $match)) {
            $token = $match[1];
        }
        $capabilities[$key] = $token;
    }
    file_put_contents($root.DIRECTORY_SEPARATOR.'.tmp'.DIRECTORY_SEPARATOR.'ekram-browser-capabilities.json', json_encode($capabilities));
    $access = app(DriverAccessService::class);
    $originalMoved = $capabilities['original'] ? $access->access($capabilities['original'], $moved?->id)['status'] : 0;
    $originalList = $capabilities['original'] ? collect($access->access($capabilities['original'])['data']['tasks'] ?? [])->pluck('recipient_name')->all() : [];
    $replacementList = $capabilities['replacement'] ? collect($access->access($capabilities['replacement'])['data']['tasks'] ?? [])->pluck('recipient_name')->all() : [];
    echo 'MOVED_DRIVER='.($moved?->driver?->full_name ?? 'missing').PHP_EOL;
    echo 'SIBLING_DRIVER='.($sibling?->driver?->full_name ?? 'missing').PHP_EOL;
    echo 'ORIGINAL_MOVED_STATUS='.$originalMoved.PHP_EOL;
    echo 'ORIGINAL_VISIBLE='.implode('|', $originalList).PHP_EOL;
    echo 'REPLACEMENT_VISIBLE='.implode('|', $replacementList).PHP_EOL;
    echo 'RECEIPTS='.DB::table('support_receipts')->count().PHP_EOL;
    echo 'MOVEMENTS='.DB::table('inventory_movements')->count().PHP_EOL;
    exit(0);
}

if (SupportDistribution::where('recipient_name', 'EKRAM-BROWSER MOVED')->exists()) {
    DB::table('system_initializations')->updateOrInsert(['key' => 'first_admin'], ['completed_at' => now(), 'updated_at' => now()]);
    $adminPassword = Str::password(20);
    $staffPassword = Str::password(20);
    User::where('username', 'EKRAM-BROWSER-ADMIN')->first()?->update(['password' => $adminPassword]);
    User::where('username', 'EKRAM-BROWSER-STAFF')->first()?->update(['password' => $staffPassword]);
    file_put_contents($authFile, json_encode([
        'admin_username' => 'EKRAM-BROWSER-ADMIN',
        'admin_password' => $adminPassword,
        'staff_username' => 'EKRAM-BROWSER-STAFF',
        'staff_password' => $staffPassword,
    ]));
    echo "FIXTURE_READY\n";
    exit(0);
}

$adminPassword = Str::password(20);
$staffPassword = Str::password(20);
$admin = User::create(['username' => 'EKRAM-BROWSER-ADMIN', 'full_name' => 'EKRAM-BROWSER ADMIN', 'password' => $adminPassword, 'role' => 'admin', 'is_active' => true, 'can_receive_notifications' => false]);
$staff = User::create(['username' => 'EKRAM-BROWSER-STAFF', 'full_name' => 'EKRAM-BROWSER STAFF', 'password' => $staffPassword, 'role' => 'staff', 'is_active' => true, 'can_receive_notifications' => false, 'permissions' => ['support' => ['view' => true]]]);
$organization = Organization::create(['name' => 'EKRAM-BROWSER ORG', 'code' => 'EKRAM_BROWSER', 'contact' => '0500000200', 'status' => 'active']);
$stock = InventoryItem::create(['name' => 'EKRAM-BROWSER ITEM', 'unit' => 'kg', 'current_quantity' => '100.00', 'min_threshold' => '1.00']);
$original = Driver::create(['full_name' => 'EKRAM-BROWSER ORIGINAL', 'phone' => '0500000201', 'is_active' => true]);
$replacement = Driver::create(['full_name' => 'EKRAM-BROWSER REPLACEMENT', 'phone' => '0500000202', 'is_active' => true]);
$service = app(SupportDistributionService::class);
$make = function (string $name) use ($service, $organization, $stock, $admin) {
    $support = $service->create(['recipient_type' => 'organization', 'organization_id' => $organization->id, 'fulfillment_method' => 'delivery', 'items' => [['inventory_item_id' => $stock->id, 'requested_quantity' => '1.00']]], $admin->id);
    $support->update(['recipient_name' => $name]);
    foreach (['approve', 'reserve', 'ready'] as $action) {
        $support = $service->transition($support->id, $action, $admin->id);
    }

    return $support->fresh();
};
$done = $make('EKRAM-BROWSER DONE');
app(DriverAccessService::class)->assign($original->id, [$done->id], 60, $admin->id);
$service->transition($done->id, 'complete', $admin->id);
$moved = $make('EKRAM-BROWSER MOVED');
$sibling = $make('EKRAM-BROWSER SIBLING');
$ready = $make('EKRAM-BROWSER READY');
app(DriverAccessService::class)->assign($original->id, [$moved->id, $sibling->id], 60, $admin->id);
file_put_contents($authFile, json_encode([
    'admin_username' => $admin->username,
    'admin_password' => $adminPassword,
    'staff_username' => $staff->username,
    'staff_password' => $staffPassword,
]));
echo "FIXTURE_READY\n";
echo 'ADMIN='.$admin->username.PHP_EOL;
echo 'STAFF='.$staff->username.PHP_EOL;
echo 'MOVED='.$moved->fresh()->status.PHP_EOL;
echo 'SIBLING='.$sibling->fresh()->status.PHP_EOL;
echo 'READY='.$ready->fresh()->status.PHP_EOL;
echo 'DONE='.$done->fresh()->status.PHP_EOL;
