<?php

use App\Models\DailyBeneficiary;
use App\Models\DailyInventoryItem;
use App\Models\InventoryItem;
use App\Models\SupportDistribution;
use App\Models\User;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

require __DIR__.'/../../vendor/autoload.php';
$app = require __DIR__.'/../../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
if (! app()->environment('testing') || config('database.default') !== 'sqlite' || ! str_contains(config('database.connections.sqlite.database'), 'qa-isolated-governance-')) {
    exit(2);
}
Artisan::call('migrate', ['--force' => true]);
$credentials = json_decode(stream_get_contents(STDIN), true, flags: JSON_THROW_ON_ERROR);
$admin = User::create(['username' => $credentials['username'], 'full_name' => 'GOVERNANCE BROWSER ADMIN', 'password' => Hash::make($credentials['password']), 'role' => 'admin', 'is_active' => true]);
DB::table('system_initializations')->updateOrInsert(['key' => 'first_admin'], ['completed_at' => now(), 'updated_at' => now()]);
for ($i = 1; $i <= 34; $i++) {
    DB::table('beneficiaries')->insert([
        'id' => (string) Str::uuid(), 'beneficiary_type' => $i % 3 ? 'citizen' : 'resident', 'full_name' => 'GOVERNANCE PERSON '.str_pad((string) $i, 2, '0', STR_PAD_LEFT),
        'national_id' => '17'.str_pad((string) $i, 8, '0', STR_PAD_LEFT), 'phone' => '05'.str_pad((string) $i, 8, '0', STR_PAD_LEFT),
        'city' => 'Jeddah', 'district' => $i % 2 ? 'North' : 'South', 'status' => 'active', 'family_members_count' => 1,
        'working_members_count' => 0, 'non_working_children_count' => 0, 'father_status' => 'alive', 'mother_status' => 'alive',
        'monthly_salary' => 1000 + $i, 'total_income' => 1000 + $i, 'net_income' => 1000 + $i, 'monthly_rent' => 0,
        'housing_type' => 'own', 'created_by' => $admin->id, 'created_at' => now()->subHours($i), 'updated_at' => now(),
    ]);
}
foreach ([['GOVERNANCE DAILY ALPHA', 'North'], ['GOVERNANCE DAILY BETA', 'South']] as $i => [$name, $district]) {
    DailyBeneficiary::create(['full_name' => $name, 'national_id' => '27'.str_pad((string) ($i + 1), 8, '0', STR_PAD_LEFT), 'phone' => '06'.str_pad((string) ($i + 1), 8, '0', STR_PAD_LEFT), 'district' => $district, 'status' => 'active', 'created_by' => $admin->id]);
}
$personId = DB::table('beneficiaries')->value('id');
foreach (['draft', 'approved', 'reserved', 'ready', 'completed'] as $status) {
    SupportDistribution::create(['recipient_type' => 'beneficiary', 'beneficiary_id' => $personId, 'recipient_name' => 'GOVERNANCE PERSON', 'fulfillment_method' => 'pickup', 'status' => $status, 'created_by' => $admin->id, 'completed_at' => $status === 'completed' ? now() : null]);
}
DB::table('support_distributions')->update(['created_at' => now()->subDay(), 'updated_at' => now()->subDay()]);
InventoryItem::create(['name' => 'MAIN GOVERNANCE', 'unit' => 'kg', 'current_quantity' => 8, 'min_threshold' => 10]);
DailyInventoryItem::create(['name' => 'DAILY GOVERNANCE', 'unit' => 'basket', 'current_quantity' => 5, 'min_threshold' => 10]);
echo json_encode(['token' => $admin->createToken('governance-browser')->plainTextToken, 'user' => $admin->only(['id', 'username', 'full_name', 'role', 'permissions'])]);
