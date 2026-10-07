<?php

use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Tests\Support\PolicyEScenario as Scenario;

require __DIR__.'/../../vendor/autoload.php';
$app = require __DIR__.'/../../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
if (! app()->environment('testing') || config('database.default') !== 'sqlite' || ! str_contains(config('database.connections.sqlite.database'), 'qa-isolated-policye-')) {
    exit(2);
}
Artisan::call('migrate', ['--force' => true]);
$credentials = json_decode(stream_get_contents(STDIN), true, flags: JSON_THROW_ON_ERROR);

$admin = Scenario::actor();
$admin->update(['username' => $credentials['admin']['username'], 'password' => $credentials['admin']['password']]);
// apply_scope only: may approve but never execute — the permission gate must
// reject the execute attempt with a real 403 rendered by the UI.
$apply = Scenario::actor(['view', 'view_application_runs', 'apply_scope'], 'assistant_admin');
$apply->update(['username' => $credentials['apply']['username'], 'password' => $credentials['apply']['password']]);
DB::table('system_initializations')->updateOrInsert(['key' => 'first_admin'], ['completed_at' => now(), 'updated_at' => now()]);

$version = Scenario::published($admin, ['application_scope' => ['applies_to' => 'all_existing_and_new']]);
$beneficiary = Scenario::beneficiary();

echo json_encode([
    'token' => $admin->createToken('policy-e-browser')->plainTextToken,
    'user' => $admin->only(['id', 'username', 'full_name', 'role', 'permissions']),
    'apply' => [
        'token' => $apply->createToken('policy-e-apply')->plainTextToken,
        'user' => $apply->only(['id', 'username', 'full_name', 'role', 'permissions']),
    ],
    'versionId' => $version->id,
    'beneficiaryName' => $beneficiary->full_name,
]);
