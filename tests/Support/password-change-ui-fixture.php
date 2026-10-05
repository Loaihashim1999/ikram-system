<?php

use App\Models\User;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\Artisan;

// Local-only HTTP/UI fixture. No production configuration or data is used.
require __DIR__.'/../../vendor/autoload.php';
$database = getenv('DB_DATABASE');
if (getenv('APP_ENV') !== 'testing' || getenv('DB_CONNECTION') !== 'sqlite'
    || ! str_starts_with(realpath($database) ?: '', realpath(__DIR__.'/../../.tmp').DIRECTORY_SEPARATOR)) {
    throw new RuntimeException('Isolated local fixture required.');
}
$app = require __DIR__.'/../../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
if (config('database.default') !== 'sqlite' || config('database.connections.sqlite.database') !== $database) {
    throw new RuntimeException('Local database configuration mismatch.');
}
Artisan::call('migrate', ['--force' => true]);
User::create(['username' => 'TEST_LOCAL_ADMIN', 'full_name' => 'TEST Local Admin', 'role' => 'admin', 'is_active' => true, 'password' => 'TEST-Old!Password123']);
$user = User::create(['username' => 'TEST_LOCAL_STAFF', 'full_name' => 'TEST Local Staff', 'role' => 'staff', 'is_active' => true, 'password' => 'TEST-Old!Password123']);
$user->forceFill(['must_change_password' => true, 'temporary_password_expires_at' => now()->addHour()])->save();
echo json_encode(['token' => $user->createToken('local-ui-test')->plainTextToken]);
