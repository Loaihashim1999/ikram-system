<?php

/**
 * FSA persistence gate — provision phase.
 *
 * Runs inside the isolated FSA env contract. Creates one representative row of
 * every named major entity in the SAME persistent QA database by writing
 * through the application's own models, then writes a manifest of the IDs and
 * expected values. The gate re-opens every record through the HTTP API after a
 * real server-process restart and a fresh login (see persistence-gate.php).
 */

require __DIR__.'/bootstrap.php';

use App\Models\DailyBeneficiary;
use App\Models\DailyInventoryItem;
use App\Models\Dependent;
use App\Models\Driver;
use App\Models\InventoryItem;
use App\Models\NeighborhoodRep;
use App\Models\PickupLocation;
use App\Models\Setting;
use App\Models\Staff;
use App\Models\SupportDistribution;
use App\Models\User;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

$evidenceDir = $_SERVER['FSa_EVIDENCE'] ?? getenv('FSA_EVIDENCE');
if (! is_dir($evidenceDir)) {
    throw new RuntimeException('ABORT: FSA_EVIDENCE directory missing.');
}

fsaBoot(fsaEnv(['DB_DATABASE' => getenv('FSA_DB_FILE'), 'SESSION_DRIVER' => 'file', 'SESSION_DRIVER_FILE_PATH' => $evidenceDir.'/sessions']));

Artisan::call('migrate', ['--force' => true]);

$admin = User::create([
    'username' => 'fsa_persist_admin',
    'full_name' => 'FSA PERSISTENCE ADMIN',
    'password' => Hash::make('fsa-persist-password!2026'),
    'role' => 'admin',
    'is_active' => true,
]);
DB::table('system_initializations')->updateOrInsert(['key' => 'first_admin'], ['completed_at' => now(), 'updated_at' => now()]);

$manifest = [];

// 1. citizen beneficiary
$citizenId = (string) Str::uuid();
DB::table('beneficiaries')->insert([
    'id' => $citizenId, 'beneficiary_type' => 'citizen', 'full_name' => 'FSA CITIZEN PERSIST',
    'national_id' => '1815000001', 'phone' => '0550001001', 'category_id' => null, 'city' => 'Riyadh',
    'district' => 'FSA DISTRICT', 'status' => 'active', 'family_members_count' => 1,
    'working_members_count' => 0, 'non_working_children_count' => 0, 'father_status' => 'alive',
    'mother_status' => 'alive', 'monthly_salary' => 0, 'housing_type' => 'own',
    'social_security_amount' => 0, 'citizen_account_amount' => 0, 'created_by' => $admin->id,
    'created_at' => now(), 'updated_at' => now(),
]);
$manifest[] = ['name' => 'citizen_beneficiary', 'expect' => ['full_name' => 'FSA CITIZEN PERSIST', 'national_id' => '1815000001', 'id' => $citizenId], 'open' => ['endpoint' => '/api/beneficiaries/'.$citizenId]];

// 2. resident beneficiary
$residentId = (string) Str::uuid();
DB::table('beneficiaries')->insert([
    'id' => $residentId, 'beneficiary_type' => 'resident', 'full_name' => 'FSA RESIDENT PERSIST',
    'national_id' => '2815000002', 'phone' => '0660001002', 'category_id' => null, 'city' => 'Jeddah',
    'district' => 'FSA DISTRICT', 'status' => 'active', 'family_members_count' => 0,
    'working_members_count' => 0, 'non_working_children_count' => 0, 'father_status' => 'alive',
    'mother_status' => 'alive', 'monthly_salary' => 0, 'housing_type' => 'rent',
    'social_security_amount' => 0, 'citizen_account_amount' => 0, 'created_by' => $admin->id,
    'created_at' => now(), 'updated_at' => now(),
]);
$manifest[] = ['name' => 'resident_beneficiary', 'expect' => ['full_name' => 'FSA RESIDENT PERSIST', 'national_id' => '2815000002', 'id' => $residentId], 'open' => ['endpoint' => '/api/beneficiaries/'.$residentId]];

// 3. family member (dependent)
$dependent = Dependent::create(['beneficiary_id' => $citizenId, 'name' => 'FSA DEPENDENT PERSIST', 'relationship' => 'ابن', 'date_of_birth' => '2015-06-01']);
$manifest[] = ['name' => 'family_member', 'expect' => ['name' => 'FSA DEPENDENT PERSIST', 'relationship' => 'ابن'], 'open' => ['endpoint' => '/api/beneficiaries/'.$citizenId, 'nested' => true]];

// 4. user/account
$account = User::create(['username' => 'fsa_account_persist', 'full_name' => 'FSA ACCOUNT PERSIST', 'password' => Hash::make('fsa-account-pass!'), 'email' => 'fsa-account@example.invalid', 'role' => 'staff', 'is_active' => true, 'can_receive_notifications' => true, 'permissions' => ['beneficiaries' => ['view' => true, 'create' => true]]]);
$manifest[] = ['name' => 'user_account', 'expect' => ['username' => 'fsa_account_persist', 'full_name' => 'FSA ACCOUNT PERSIST', 'role' => 'staff'], 'open' => ['endpoint' => '/api/users', 'find' => ['username' => 'fsa_account_persist']]];

// 5. staff
$staff = Staff::create(['name' => 'FSA STAFF PERSIST', 'national_id' => '1012345678', 'phone' => '0550003003', 'job_title' => 'محاسب', 'department' => 'المالية', 'hire_date' => '2024-01-15', 'status' => 'active']);
$manifest[] = ['name' => 'staff', 'expect' => ['name' => 'FSA STAFF PERSIST', 'national_id' => '1012345678', 'job_title' => 'محاسب'], 'open' => ['endpoint' => '/api/staff/'.$staff->id]];

// 6. organization/neighborhood representative
$rep = NeighborhoodRep::create(['full_name' => 'FSA REP PERSIST', 'phone' => '0550004004', 'district_name' => 'FSA DISTRICT', 'city' => 'Riyadh', 'status' => 'active']);
$manifest[] = ['name' => 'organization_rep', 'expect' => ['full_name' => 'FSA REP PERSIST', 'district_name' => 'FSA DISTRICT', 'id' => $rep->id], 'open' => ['endpoint' => '/api/neighborhood-reps/'.$rep->id]];

// 7. daily beneficiary
$daily = DailyBeneficiary::create(['full_name' => 'FSA DAILY PERSIST', 'national_id' => '2815000006', 'phone' => '0660005005', 'district' => 'FSA DAILY DISTRICT', 'status' => 'active', 'created_by' => $admin->id]);
$manifest[] = ['name' => 'daily_beneficiary', 'expect' => ['full_name' => 'FSA DAILY PERSIST', 'national_id' => '2815000006', 'id' => $daily->id], 'open' => ['endpoint' => '/api/daily-beneficiaries/'.$daily->id]];

// 8. General Warehouse item
$warehouse = InventoryItem::create(['name' => 'FSA WAREHOUSE ITEM', 'unit' => 'كرتون', 'current_quantity' => 42, 'min_threshold' => 5]);
$manifest[] = ['name' => 'general_warehouse_item', 'expect' => ['name' => 'FSA WAREHOUSE ITEM', 'current_quantity' => '42'], 'open' => ['endpoint' => '/api/inventory', 'find' => ['name' => 'FSA WAREHOUSE ITEM']]];

// 9. Daily Beneficiary Inventory item
$dailyItem = DailyInventoryItem::create(['name' => 'FSA DAILY ITEM', 'unit' => 'سلة', 'current_quantity' => 17, 'min_threshold' => 3]);
$manifest[] = ['name' => 'daily_inventory_item', 'expect' => ['name' => 'FSA DAILY ITEM', 'current_quantity' => 17, 'id' => $dailyItem->id], 'open' => ['endpoint' => '/api/daily-inventory/'.$dailyItem->id]];

// 10. support distribution/reservation
$support = SupportDistribution::create(['recipient_type' => 'beneficiary', 'beneficiary_id' => $citizenId, 'recipient_name' => 'FSA CITIZEN PERSIST', 'fulfillment_method' => 'pickup', 'pickup_location_id' => null, 'status' => 'reserved', 'support_date' => now()->addDays(2), 'created_by' => $admin->id, 'notes' => 'FSA SUPPORT NOTE']);
$manifest[] = ['name' => 'support_distribution', 'expect' => ['recipient_name' => 'FSA CITIZEN PERSIST', 'status' => 'reserved'], 'open' => ['endpoint' => '/api/support/distributions/'.$support->id]];

// 11. driver
$driver = Driver::create(['full_name' => 'FSA DRIVER PERSIST', 'phone' => '0555555555', 'vehicle_info' => 'FSA TRUCK', 'is_active' => true]);
$manifest[] = ['name' => 'driver', 'expect' => ['full_name' => 'FSA DRIVER PERSIST', 'phone' => '0555555555'], 'open' => ['endpoint' => '/api/support/drivers', 'find' => ['phone' => '0555555555']]];

// 12. pickup location
$pickup = PickupLocation::create(['name' => 'FSA PICKUP POINT', 'address' => 'FSA ADDRESS 1', 'city' => 'Riyadh', 'district' => 'FSA DISTRICT', 'is_active' => true]);
$manifest[] = ['name' => 'pickup_location', 'expect' => ['name' => 'FSA PICKUP POINT', 'address' => 'FSA ADDRESS 1'], 'open' => ['endpoint' => '/api/support/pickup-locations', 'find' => ['name' => 'FSA PICKUP POINT']]];

// 13. System Settings
Setting::set('fsa.persistence.test', 'FSA-SETTING-VALUE-42');
$manifest[] = ['name' => 'system_setting', 'expect' => ['fsa.persistence.test' => 'FSA-SETTING-VALUE-42'], 'open' => ['endpoint' => '/api/settings']];

// 14. active SMS template (driver assignment template stored in settings)
Setting::set('communications.driver_assignment_sms', 'FSA SMS تجربة {driver_name} {temporary_driver_link} {association_name}');
$manifest[] = ['name' => 'active_sms_template', 'expect' => ['driver_assignment_sms' => 'FSA SMS تجربة {driver_name} {temporary_driver_link} {association_name}'], 'open' => ['endpoint' => '/api/settings/communications']];

file_put_contents($evidenceDir.'/manifest.json', json_encode(['username' => 'fsa_persist_admin', 'password' => 'fsa-persist-password!2026', 'entities' => $manifest], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
echo 'PROVISION_OK entities='.count($manifest).PHP_EOL;
