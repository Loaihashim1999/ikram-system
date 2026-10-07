<?php

use App\Models\User;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

require __DIR__.'/../../vendor/autoload.php';
$app = require __DIR__.'/../../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
if (! app()->environment('testing') || config('database.default') !== 'sqlite' || ! str_contains(config('database.connections.sqlite.database'), 'qa-isolated-fsa-')) {
    exit(2);
}
Artisan::call('migrate', ['--force' => true]);
$credentials = json_decode(stream_get_contents(STDIN), true, flags: JSON_THROW_ON_ERROR);
$username = $credentials['username'] ?? 'FSA_CLOSURE_ADMIN';
$password = $credentials['password'] ?? Str::random(24);
$admin = User::create(['username' => $username, 'full_name' => 'FSA CLOSURE ADMIN', 'password' => Hash::make($password), 'role' => 'admin', 'is_active' => true, 'can_receive_notifications' => true]);
DB::table('system_initializations')->updateOrInsert(['key' => 'first_admin'], ['completed_at' => now(), 'updated_at' => now()]);
$staff = User::create(['username' => 'FSA_STAFF_'.Str::random(6), 'full_name' => 'FSA Closure Staff', 'password' => Hash::make($password), 'role' => 'staff', 'is_active' => true, 'can_receive_notifications' => true, 'permissions' => ['beneficiaries' => ['view' => true, 'create' => true, 'edit' => true, 'delete' => true, 'export' => true, 'import' => true, 'issue_document' => true], 'daily_beneficiaries' => ['view' => true, 'create' => true, 'edit' => true, 'delete' => true, 'export' => true, 'import' => true, 'issue_document' => true], 'notifications' => ['view' => true, 'mark_read' => true]]]);
echo json_encode([
    'token' => $admin->createToken('fsa-closure-browser')->plainTextToken,
    'user' => $admin->only(['id', 'username', 'full_name', 'role', 'permissions']),
    'staff' => ['username' => $staff->username, 'password' => $password],
]);
