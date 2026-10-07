<?php

use App\Models\Category;
use App\Models\DailyBeneficiary;
use App\Models\User;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

require __DIR__.'/../../vendor/autoload.php';
$app = require __DIR__.'/../../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
if (! app()->environment('testing') || config('database.default') !== 'sqlite' || ! str_contains(config('database.connections.sqlite.database'), 'qa-isolated-policyf-')) {
    exit(2);
}
Artisan::call('migrate', ['--force' => true]);
$credentials = json_decode(stream_get_contents(STDIN), true, flags: JSON_THROW_ON_ERROR);
$admin = User::create(['username' => $credentials['username'], 'full_name' => 'POLICY F BROWSER ADMIN', 'password' => Hash::make($credentials['password']), 'role' => 'admin', 'is_active' => true]);
$category = Category::create(['name' => 'POLICY F BROWSER']);
DB::table('system_initializations')->updateOrInsert(['key' => 'first_admin'], ['completed_at' => now(), 'updated_at' => now()]);
for ($i = 1; $i <= 30; $i++) {
    DB::table('beneficiaries')->insert([
        'id' => (string) Str::uuid(), 'beneficiary_type' => 'citizen', 'full_name' => 'PERMANENT BROWSER '.str_pad((string) $i, 2, '0', STR_PAD_LEFT),
        'national_id' => '18'.str_pad((string) $i, 8, '0', STR_PAD_LEFT), 'phone' => '05'.str_pad((string) $i, 8, '0', STR_PAD_LEFT),
        'category_id' => $category->id, 'city' => $i === 30 ? 'Jeddah' : 'Riyadh', 'district' => 'Permanent District', 'status' => 'active',
        'family_members_count' => 1, 'working_members_count' => 0, 'non_working_children_count' => 0, 'father_status' => 'alive', 'mother_status' => 'alive',
        'monthly_salary' => 0, 'housing_type' => 'own', 'social_security_amount' => 0, 'citizen_account_amount' => 0,
        'created_by' => $admin->id, 'created_at' => now()->addSeconds($i), 'updated_at' => now(),
    ]);
}
foreach ([['DAILY BROWSER ALPHA', 'North'], ['DAILY BROWSER BETA', 'South']] as $i => [$name, $district]) {
    DailyBeneficiary::create(['full_name' => $name, 'national_id' => '28'.str_pad((string) ($i + 1), 8, '0', STR_PAD_LEFT), 'phone' => '06'.str_pad((string) ($i + 1), 8, '0', STR_PAD_LEFT), 'district' => $district, 'status' => 'active', 'created_by' => $admin->id]);
}
echo json_encode(['token' => $admin->createToken('policy-f-browser')->plainTextToken, 'user' => $admin->only(['id', 'username', 'full_name', 'role', 'permissions'])]);
