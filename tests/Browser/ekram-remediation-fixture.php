<?php

require dirname(__DIR__).'/Fsa/bootstrap.php';

use App\Models\Beneficiary;
use App\Models\CommunicationMessage;
use App\Models\InventoryItem;
use App\Models\PickupLocation;
use App\Models\User;
use App\Services\SupportDistributionService;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Schema;
use Tests\Support\PolicyEScenario;

$database = getenv('DB_DATABASE');
$root = dirname(__DIR__, 2);
$allowed = realpath($root.'/.tmp/ekram-remediation');
if (! $allowed || ! is_string($database) || ! str_starts_with(str_replace('\\', '/', $database), str_replace('\\', '/', $allowed).'/') || ! str_ends_with($database, '.sqlite')) {
    throw new RuntimeException('ABORT: isolated remediation database required.');
}
$env = fsaEnv(['DB_DATABASE' => $database, 'APP_KEY' => getenv('APP_KEY'), 'APP_URL' => getenv('APP_URL'), 'QUEUE_CONNECTION' => 'database']);
ob_start();
fsaApplyEnv($env);
$app = require $root.'/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
$safety = fsaAssertSafe();
config(['filesystems.default' => 'local', 'filesystems.disks.public.driver' => 'local', 'filesystems.disks.public.root' => $allowed.'/uploads/'.basename($database), 'filesystems.disks.local.root' => $allowed.'/local/'.basename($database)]);
ob_end_clean();
if (PHP_SAPI === 'cli-server') {
    $uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
    if ($uri === '/up') {
        header('Content-Type: application/json');
        echo json_encode($safety);

        return;
    }
    $app->handleRequest(Request::capture());

    return;
}
$input = json_decode(stream_get_contents(STDIN), true, flags: JSON_THROW_ON_ERROR);
if (($input['mode'] ?? 'seed') === 'manifest') {
    $tables = [];
    foreach (['users', 'beneficiaries', 'dependents', 'inventory_items', 'pickup_locations', 'support_distributions', 'support_distribution_items', 'support_receipts', 'receipt_challenges', 'drivers', 'driver_assignments', 'driver_assignment_tasks', 'communication_messages', 'notifications', 'beneficiary_policy_versions', 'beneficiary_policy_evaluations', 'policy_decisions', 'audit_logs', 'inventory_movements', 'settings'] as $table) {
        if (Schema::hasTable($table)) {
            $tables[$table] = ['count' => DB::table($table)->count()];
            if (Schema::hasColumn($table, 'id')) {
                $tables[$table]['ids'] = DB::table($table)->pluck('id')->all();
            }
        }
    }
    echo json_encode(['tables' => $tables]);

    return;
}
if (($input['mode'] ?? 'seed') === 'inspect') {
    $messages = CommunicationMessage::orderBy('created_at')->get();
    $codes = [];
    $links = [];
    foreach ($messages as $message) {
        $body = $message->encrypted_payload['body'] ?? '';
        if (preg_match('/رمز الاستلام: ([0-9]{4})/', $body, $m)) {
            $codes[$message->operation_id] = $m[1];
        }
        if (preg_match('/driver-access#([a-f0-9]{64})/', $body, $m)) {
            $links[$message->operation_id] = $m[1];
        }
    }
    echo json_encode(['codes' => $codes, 'links' => $links, 'outbox' => $messages->map(fn ($m) => ['id' => $m->id, 'channel' => $m->channel, 'status' => $m->status, 'operation_id' => $m->operation_id])->values(), 'beneficiaries' => Beneficiary::where('full_name', 'like', 'EKRAM-E2E-TEST%')->get(['id', 'full_name', 'beneficiary_type', 'confirmed_at'])->toArray()]);

    return;
}
Artisan::call('migrate', ['--force' => true]);
Queue::fake();
$admin = User::create(['username' => $input['username'], 'password' => $input['password'], 'full_name' => 'EKRAM-E2E-TEST Admin', 'role' => 'admin', 'is_active' => true, 'can_receive_notifications' => true]);
DB::table('system_initializations')->updateOrInsert(['key' => 'first_admin'], ['completed_at' => now(), 'updated_at' => now()]);
$policy = PolicyEScenario::published($admin, ['application_scope' => ['applies_to' => 'all_existing_and_new']], ['policy_name' => 'EKRAM-E2E-TEST Policy']);
$beneficiary = Beneficiary::create(['full_name' => 'EKRAM-E2E-TEST Seed Recipient', 'national_id' => '1999999901', 'phone' => '0501234567', 'beneficiary_type' => 'citizen', 'status' => 'active', 'confirmed_at' => now(), 'confirmed_by' => $admin->id, 'city' => 'مكة المكرمة', 'district' => 'EKRAM-E2E-TEST District', 'street' => 'EKRAM-E2E-TEST Address', 'family_members_count' => 1]);
$stock = InventoryItem::create(['name' => 'EKRAM-E2E-TEST Basket', 'unit' => 'سلة', 'current_quantity' => 100, 'min_threshold' => 1]);
$location = PickupLocation::create(['name' => 'EKRAM-E2E-TEST Pickup', 'location_url' => 'https://example.test/pickup']);
$operations = [];
foreach (['pickup', 'delivery'] as $method) {
    $service = app(SupportDistributionService::class);
    $support = $service->create(['recipient_type' => 'beneficiary', 'beneficiary_id' => $beneficiary->id, 'fulfillment_method' => $method, 'pickup_location_id' => $method === 'pickup' ? $location->id : null, 'items' => [['inventory_item_id' => $stock->id, 'requested_quantity' => '1.00']]], $admin->id);
    foreach (['approve', 'reserve', 'ready'] as $action) {
        $support = $service->transition($support->id, $action, $admin->id);
    }
    $operations[$method] = $support->id;
}
echo json_encode(['safety' => $safety, 'auth' => ['token' => $admin->createToken('EKRAM-E2E-TEST')->plainTextToken, 'user' => $admin->toArray()], 'ids' => ['policy' => $policy->id, 'admin' => $admin->id, 'beneficiary' => $beneficiary->id, 'stock' => $stock->id, 'location' => $location->id] + $operations]);
