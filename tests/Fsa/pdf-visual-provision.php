<?php

/**
 * FSA Arabic multi-page PDF gate — provision phase.
 *
 * Boots inside the isolated FSA env contract, migrates a persistent QA SQLite
 * file, and seeds a beneficiary plus enough distribution history to force a
 * multi-page Arabic PDF (real names, addresses and notes). Prints the admin
 * credentials manifest; the gate phase logs in through the real HTTP server,
 * downloads /api/documents/total-delivery/{id}/pdf, renders every page with
 * poppler and writes PNGs for visual page inspection.
 */

require __DIR__.'/bootstrap.php';

use App\Models\Basket;
use App\Models\Beneficiary;
use App\Models\Distribution;
use App\Models\User;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

$evidenceDir = $_SERVER['FSA_EVIDENCE'] ?? getenv('FSA_EVIDENCE');
$dbFile = $_SERVER['FSA_DB_FILE'] ?? getenv('FSA_DB_FILE');
if (! is_dir($evidenceDir) || ! $dbFile) {
    throw new RuntimeException('ABORT: FSA_EVIDENCE / FSA_DB_FILE missing.');
}

fsaBoot(fsaEnv(['DB_DATABASE' => $dbFile, 'SESSION_DRIVER' => 'file', 'SESSION_DRIVER_FILE_PATH' => $evidenceDir.'/sessions']));

Artisan::call('migrate', ['--force' => true]);

$admin = User::create([
    'username' => 'fsa_pdf_admin',
    'full_name' => 'FSA PDF ADMIN',
    'password' => Hash::make('fsa-pdf-password!2026'),
    'role' => 'admin',
    'is_active' => true,
]);
DB::table('system_initializations')->updateOrInsert(['key' => 'first_admin'], ['completed_at' => now(), 'updated_at' => now()]);

$beneficiary = Beneficiary::create([
    'beneficiary_type' => 'citizen',
    'full_name' => 'مستفيد عربي متعدد الصفحات محمد عبدالله أحمد العتيبي',
    'national_id' => '1880456789',
    'phone' => '0550456789',
    'category_id' => null,
    'status' => 'active',
    'city' => 'مكة المكرمة',
    'district' => 'حي العتيبية',
    'street' => str_repeat('شارع الملك عبدالعزيز حي العتيبية ', 6),
    'family_members_count' => 6,
    'working_members_count' => 2,
    'non_working_children_count' => 3,
    'father_status' => 'alive',
    'mother_status' => 'alive',
    'monthly_salary' => 4500.50,
    'housing_type' => 'rent',
    'monthly_rent_amount' => 1200,
    'social_security_amount' => 0,
    'citizen_account_amount' => 0,
    'created_by' => $admin->id,
    'created_at' => now(),
    'updated_at' => now(),
]);

$basket = Basket::create(['name' => 'سلة رمضان الأساسية كاملة', 'stock_quantity' => 200]);
Basket::create(['name' => 'سلة شتوية داعمة', 'stock_quantity' => 150]);

// Seed 85 distributions so the official history document reliably spans
// several pages (the existing PdfFinalizationTest requires 85 for >1 page).
// 'notes' is intentionally omitted (not mass-assignable); page span comes from
// 85 receipt rows plus the long Arabic beneficiary address.
$statuses = ['delivered', 'delivered', 'delivered', 'scheduled', 'cancelled'];
for ($i = 1; $i <= 85; $i++) {
    Distribution::create([
        'beneficiary_id' => $beneficiary->id,
        'basket_id' => $basket->id,
        'assigned_by' => $admin->id,
        'scheduled_at' => now()->subDays(85 - $i),
        'delivered_at' => in_array($statuses[$i % 5], ['delivered', 'scheduled'], true) ? now()->subDays(85 - $i)->addHours(3) : null,
        'barcode_code' => 'PDF_AR_'.$i.strtoupper(Str::random(6)),
        'status' => $statuses[$i % 5] === 'scheduled' ? 'delivered' : $statuses[$i % 5],
    ]);
}

file_put_contents($evidenceDir.'/pdf-visual-manifest.json', json_encode([
    'username' => 'fsa_pdf_admin',
    'password' => 'fsa-pdf-password!2026',
    'beneficiary_id' => (string) $beneficiary->id,
    'distribution_count' => 85,
], JSON_PRETTY_PRINT));

echo 'PDF_VISUAL_PROVISIONED=1'.PHP_EOL;
echo 'BENEFICIARY_ID='.$beneficiary->id.PHP_EOL;
