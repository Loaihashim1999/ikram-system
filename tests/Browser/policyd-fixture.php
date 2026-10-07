<?php

use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Tests\Support\PolicyDScenario as Scenario;

require __DIR__.'/../../vendor/autoload.php';
$app = require __DIR__.'/../../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
if (! app()->environment('testing') || config('database.default') !== 'sqlite' || ! str_contains(config('database.connections.sqlite.database'), 'qa-isolated-policyd-')) {
    exit(2);
}
Artisan::call('migrate', ['--force' => true]);
$credentials = json_decode(stream_get_contents(STDIN), true, flags: JSON_THROW_ON_ERROR);
$admin = Scenario::actor();
$admin->update(['username' => $credentials['admin']['username'], 'password' => $credentials['admin']['password']]);
$viewer = Scenario::actor(['view_documents'], 'staff');
DB::table('system_initializations')->updateOrInsert(['key' => 'first_admin'], ['completed_at' => now(), 'updated_at' => now()]);
$evaluation = Scenario::evaluation($admin);
$reject = Scenario::evaluation($admin);
$pending = Scenario::evaluation($admin);
echo json_encode([
    'token' => $admin->createToken('policy-d-browser')->plainTextToken, 'user' => $admin->only(['id', 'username', 'full_name', 'role', 'permissions']),
    'viewer' => ['token' => $viewer->createToken('policy-d-viewer')->plainTextToken, 'user' => $viewer->only(['id', 'username', 'full_name', 'role', 'permissions'])],
    'evaluation' => $evaluation->id, 'reject_evaluation' => $reject->id, 'pending_evaluation' => $pending->id,
    'expected' => ['financial-result' => (string) $evaluation->financial_snapshot['net_income_per_capita'], 'income-category' => $evaluation->income_category, 'policy-score' => $evaluation->policy_score, 'score-category' => $evaluation->score_category],
]);
