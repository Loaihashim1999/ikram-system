<?php

use App\Models\User;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\Artisan;

// Disposable local QA only; never connect to a production database.
require __DIR__.'/../../vendor/autoload.php';
$database = getenv('DB_DATABASE');
if (getenv('APP_ENV') !== 'testing' || getenv('DB_CONNECTION') !== 'sqlite'
    || ! str_starts_with(realpath($database) ?: '', realpath(__DIR__.'/../../.tmp').DIRECTORY_SEPARATOR)) {
    throw new RuntimeException('Isolated local fixture required.');
}
$app = require __DIR__.'/../../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
if (config('database.default') !== 'sqlite' || config('database.connections.sqlite.database') !== $database) {
    throw new RuntimeException('Local configuration mismatch.');
}
Artisan::call('migrate', ['--force' => true]);
$admin = User::create(['username' => 'EKRAM-E2E-TEST-ADMIN', 'full_name' => 'EKRAM-E2E-TEST ADMIN', 'role' => 'admin', 'is_active' => true, 'password' => bin2hex(random_bytes(24))]);
$permissions = [];
foreach (['support', 'beneficiary_policy', 'beneficiaries', 'daily_beneficiaries', 'warehouse', 'staff', 'representatives', 'delivery', 'receiver', 'governance', 'audit', 'settings'] as $module) {
    $permissions[$module] = ['view' => false, 'create' => false, 'edit' => false, 'delete' => false, 'notifications' => false];
}
$permissions['representatives']['view'] = true;
$user = User::create(['username' => 'EKRAM-E2E-TEST-STAFF', 'full_name' => 'EKRAM-E2E-TEST STAFF', 'email' => 'test@example.invalid', 'phone' => '0500000000', 'role' => 'assistant_admin', 'is_active' => true, 'permissions' => $permissions, 'password' => bin2hex(random_bytes(24))]);
$readonly = User::create(['username' => 'EKRAM-E2E-TEST-READONLY', 'full_name' => 'EKRAM-E2E-TEST READONLY', 'role' => 'readonly', 'is_active' => true, 'password' => bin2hex(random_bytes(24))]);
echo json_encode(['admin_token' => $admin->createToken('local-ui-test')->plainTextToken, 'readonly_token' => $readonly->createToken('local-ui-test')->plainTextToken, 'user_id' => $user->id]);
