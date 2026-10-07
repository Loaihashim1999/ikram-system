<?php

use App\Models\CommunicationMessage;
use App\Models\Driver;
use App\Models\DriverAssignment;
use App\Models\InventoryItem;
use App\Models\Organization;
use App\Models\ReceiptChallenge;
use App\Models\User;
use App\Services\Delivery\DriverAccessService;
use App\Services\Delivery\ReceiptVerificationService;
use App\Services\SupportDistributionService;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Queue;

require dirname(__DIR__, 2).'/vendor/autoload.php';
try {
    if (getenv('APP_ENV') !== 'testing' || getenv('DB_CONNECTION') !== 'sqlite' || ! str_contains(getenv('DB_DATABASE'), 'qa-isolated-phase2b-')) {
        throw new RuntimeException('Unsafe fixture');
    }
    $app = require dirname(__DIR__, 2).'/bootstrap/app.php';
    $app->make(Kernel::class)->bootstrap();
    if (config('database.default') !== 'sqlite' || config('database.connections.sqlite.database') !== getenv('DB_DATABASE')) {
        throw new RuntimeException('Resolved fixture mismatch');
    }
    Artisan::call('migrate', ['--force' => true]);
    Queue::fake();
    $actor = User::create(['username' => 'TEST_BROWSER_2B', 'full_name' => 'TEST مدير', 'password' => bin2hex(random_bytes(24)), 'role' => 'admin', 'is_active' => true]);
    $driver = Driver::create(['full_name' => 'TEST سائق التجربة', 'phone' => '0501234567', 'is_active' => true, 'whatsapp_opt_in' => true, 'whatsapp_opt_in_at' => now(), 'whatsapp_opt_in_source' => 'browser_fixture']);
    $org = Organization::create(['name' => 'TEST جهة الاستلام', 'code' => 'TEST_BROWSER', 'contact' => '0501234568', 'status' => 'active']);
    $stock = InventoryItem::create(['name' => 'TEST أرز', 'unit' => 'كجم', 'current_quantity' => '10', 'min_threshold' => '0.75']);
    $s = app(SupportDistributionService::class);
    $support = $s->create(['recipient_type' => 'organization', 'organization_id' => $org->id, 'fulfillment_method' => 'delivery', 'items' => [['inventory_item_id' => $stock->id, 'requested_quantity' => '2.50']]], $actor->id);
    foreach (['approve', 'reserve', 'ready'] as $action) {
        $s->transition($support->id, $action, $actor->id);
    }
    app(ReceiptVerificationService::class)->issue($support->id, $actor->id);
    $c = ReceiptChallenge::first();
    $c->update(['verifier' => hash_hmac('sha256', 'receipt:'.$support->id.':'.$c->generation.':0042', config('app.key'))]);
    $a = app(DriverAccessService::class)->assign($driver->id, [$support->id], 60, $actor->id);
    $body = CommunicationMessage::where('operation_id', $a->id)->first()->encrypted_payload['body'];
    preg_match('/driver-access#([a-f0-9]{64})/', $body, $match);
    $expiredToken = bin2hex(random_bytes(32));
    DriverAssignment::create(['driver_id' => $driver->id, 'created_by' => $actor->id, 'token_hash' => hash('sha256', $expiredToken), 'expires_at' => now()->subMinute()]);
    // Consumed by the parent test process in memory only; never written to evidence/logs.
    echo json_encode(['expired_token' => $expiredToken, 'driver_token' => $match[1], 'admin_token' => $actor->createToken('TEST browser')->plainTextToken, 'user' => $actor, 'task_id' => $support->id]);
} catch (Throwable) {
    fwrite(STDERR, "Isolated browser fixture failed.\n");
    exit(1);
}
