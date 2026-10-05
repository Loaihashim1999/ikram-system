<?php

namespace Tests\Feature\Phase2;

use App\Models\Beneficiary;
use App\Models\BeneficiaryPolicyEvaluation;
use App\Models\DailyBeneficiary;
use App\Models\PolicyDecision;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\Support\PolicyEScenario;
use Tests\TestCase;

class BeneficiaryNationalityAndImportTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::create([
            'username' => 'nat_import_admin',
            'full_name' => 'Nationality Import Admin',
            'password' => Hash::make('password'),
            'role' => 'admin',
            'is_active' => true,
        ]);
        Sanctum::actingAs($this->admin);
    }

    public function test_saudi_nationality_derives_citizen_and_another_nationality_derives_resident(): void
    {
        $saudi = $this->postJson('/api/beneficiaries', $this->permanentPayload([
            'national_id' => '1000000201',
            'nationality' => '  سعودي  ',
        ]))->assertCreated();
        $this->assertSame('citizen', $saudi->json('data.beneficiary_type'));
        $this->assertSame('سعودي', $saudi->json('data.nationality'));
        $this->assertDatabaseHas('beneficiaries', [
            'national_id' => '1000000201',
            'nationality' => 'سعودي',
            'beneficiary_type' => 'citizen',
        ]);

        $resident = $this->postJson('/api/beneficiaries', $this->permanentPayload([
            'national_id' => '1000000202',
            'nationality' => 'يمني',
        ]))->assertCreated();
        $this->assertSame('resident', $resident->json('data.beneficiary_type'));
        $this->assertSame('يمني', $resident->json('data.nationality'));

        $englishSaudi = $this->postJson('/api/beneficiaries', $this->permanentPayload([
            'national_id' => '1000000203',
            'nationality' => 'Saudi',
        ]))->assertCreated();
        $this->assertSame('resident', $englishSaudi->json('data.beneficiary_type'));

        $dailySaudi = $this->postJson('/api/daily-beneficiaries', $this->dailyPayload([
            'national_id' => '1234567890',
            'nationality' => 'سعودي',
        ]))->assertCreated();
        $this->assertSame('citizen', $dailySaudi->json('data.beneficiary_type'));
        $this->assertSame('سعودي', $dailySaudi->json('data.nationality'));

        $dailyResident = $this->postJson('/api/daily-beneficiaries', $this->dailyPayload([
            'national_id' => '1234567891',
            'nationality' => 'يمني',
        ]))->assertCreated();
        $this->assertSame('resident', $dailyResident->json('data.beneficiary_type'));
        $this->assertDatabaseHas('daily_beneficiaries', [
            'national_id' => '1234567891',
            'nationality' => 'يمني',
            'beneficiary_type' => 'resident',
        ]);
    }

    public function test_missing_or_disagreeing_nationality_is_unprocessable_and_writes_nothing(): void
    {
        $this->postJson('/api/beneficiaries', $this->permanentPayload(['nationality' => '   ']))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('nationality');
        $this->postJson('/api/beneficiaries', $this->permanentPayload([
            'nationality' => 'سعودي',
            'beneficiary_type' => 'resident',
        ]))->assertUnprocessable()->assertJsonValidationErrors('beneficiary_type');
        $this->postJson('/api/daily-beneficiaries', $this->dailyPayload(['nationality' => null]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('nationality');
        $this->postJson('/api/daily-beneficiaries', $this->dailyPayload([
            'national_id' => '2234567890',
            'nationality' => 'سعودي',
            'beneficiary_type' => 'resident',
        ]))->assertUnprocessable()->assertJsonValidationErrors('beneficiary_type');

        $this->assertSame(0, Beneficiary::count());
        $this->assertSame(0, DailyBeneficiary::count());
        $this->assertSame(0, BeneficiaryPolicyEvaluation::count());
    }

    public function test_nationality_change_keeps_historical_evaluation_and_requires_confirmation(): void
    {
        PolicyEScenario::published($this->admin, ['application_scope' => ['applies_to' => 'all_existing_and_new']]);

        $created = $this->postJson('/api/beneficiaries', $this->permanentPayload([
            'national_id' => '1000000210',
            'nationality' => 'سعودي',
            'income_sources' => ['salary', 'social_security'],
            'monthly_salary' => 700,
            'social_security_amount' => 100,
        ]))->assertCreated();
        $id = $created->json('data.id');
        $this->assertSame(1, BeneficiaryPolicyEvaluation::count());
        $before = BeneficiaryPolicyEvaluation::query()->firstOrFail()->getAttributes();

        $this->putJson('/api/beneficiaries/'.$id, $this->permanentPayload([
            'national_id' => '1000000210',
            'nationality' => 'يمني',
            'reviewed_confirmation' => false,
        ]))->assertUnprocessable();
        $this->assertSame('citizen', Beneficiary::findOrFail($id)->beneficiary_type);
        $this->assertSame($before, BeneficiaryPolicyEvaluation::query()->firstOrFail()->getAttributes());

        $this->putJson('/api/beneficiaries/'.$id, $this->permanentPayload([
            'national_id' => '1000000210',
            'nationality' => 'يمني',
            'beneficiary_type' => 'resident',
            'reviewed_confirmation' => true,
            'income_sources' => ['salary', 'social_security'],
            'monthly_salary' => 700,
            'social_security_amount' => 100,
        ]))->assertOk();

        $updated = Beneficiary::findOrFail($id);
        $this->assertSame('resident', $updated->beneficiary_type);
        $this->assertSame('يمني', $updated->nationality);
        $this->assertSame(1, BeneficiaryPolicyEvaluation::count());
        $this->assertSame(0, PolicyDecision::count());
        $this->assertSame($before, BeneficiaryPolicyEvaluation::query()->firstOrFail()->getAttributes());
    }

    public function test_import_without_confirmation_and_preview_write_nothing(): void
    {
        $file = $this->csv("full_name,national_id,phone,nationality\nTEST IMPORT,1999999701,0501234567,سعودي\n");

        $this->post('/api/smart-import/beneficiaries/preview', [
            'target' => 'permanent',
            'file' => $file,
        ], ['Accept' => 'application/json'])->assertOk()
            ->assertJsonPath('fields.nationality.required', true)
            ->assertJsonPath('sheets.0.row_count', 1);

        $this->post('/api/smart-import/beneficiaries', [
            'target' => 'permanent',
            'file' => $file,
            'mapping' => json_encode([
                'full_name' => 'full_name',
                'national_id' => 'national_id',
                'phone' => 'phone',
                'nationality' => 'nationality',
            ]),
        ], ['Accept' => 'application/json'])->assertUnprocessable()->assertJsonValidationErrors('reviewed_confirmation');

        $this->post('/api/smart-import/beneficiaries', [
            'reviewed_confirmation' => true,
            'file' => $file,
            'mapping' => json_encode(['full_name' => 'full_name']),
        ], ['Accept' => 'application/json'])->assertUnprocessable()->assertJsonValidationErrors('target');

        $this->postJson('/api/beneficiaries/import', [
            'reviewed_confirmation' => true,
            'rows' => [[
                'full_name' => '',
                'national_id' => '1999999702',
                'phone' => '',
            ]],
        ])->assertUnprocessable();

        $this->assertSame(0, Beneficiary::count());
        $this->assertSame(0, DailyBeneficiary::count());
        $this->assertDatabaseMissing('beneficiaries', ['full_name' => 'مستفيد جديد']);
        $this->assertDatabaseMissing('beneficiaries', ['phone' => '0500000000']);
        $this->assertSame(0, BeneficiaryPolicyEvaluation::count());
        $this->assertSame(0, DB::table('support_distributions')->count());
        $this->assertSame(0, DB::table('communication_messages')->count());
    }

    public function test_confirmed_import_derives_classification_and_does_not_create_policy_evaluation(): void
    {
        PolicyEScenario::published($this->admin, ['application_scope' => ['applies_to' => 'all_existing_and_new']]);

        $csv = "full_name,national_id,phone,nationality,beneficiary_type\n"
            ."TEST SAUDI,1999999801,0501111111,سعودي,\n"
            ."TEST RESIDENT,1999999802,0501111112,يمني,\n"
            ."TEST BLANK,1999999803,0501111113,,\n"
            ."TEST DUP,1999999801,0501111114,سعودي,\n"
            ."TEST DISAGREE,1999999804,0501111115,سعودي,resident\n";

        $response = $this->post('/api/smart-import/beneficiaries', [
            'target' => 'permanent',
            'reviewed_confirmation' => true,
            'file' => $this->csv($csv),
            'mapping' => json_encode([
                'full_name' => 'full_name',
                'national_id' => 'national_id',
                'phone' => 'phone',
                'nationality' => 'nationality',
                'beneficiary_type' => 'beneficiary_type',
            ]),
        ], ['Accept' => 'application/json'])->assertOk();

        $response->assertJsonPath('created', 2)
            ->assertJsonPath('skipped', 1)
            ->assertJsonPath('failed', 2)
            ->assertJsonPath('total', 5);
        $this->assertDatabaseHas('beneficiaries', [
            'national_id' => '1999999801',
            'nationality' => 'سعودي',
            'beneficiary_type' => 'citizen',
        ]);
        $this->assertDatabaseHas('beneficiaries', [
            'national_id' => '1999999802',
            'nationality' => 'يمني',
            'beneficiary_type' => 'resident',
        ]);
        $this->assertDatabaseMissing('beneficiaries', ['national_id' => '1999999803']);
        $this->assertDatabaseMissing('beneficiaries', ['national_id' => '1999999804']);
        $this->assertNotNull(Beneficiary::where('national_id', '1999999801')->firstOrFail()->confirmed_at);
        $this->assertSame(0, BeneficiaryPolicyEvaluation::count());
        $this->assertSame(0, PolicyDecision::count());
        $this->assertSame(0, DB::table('support_distributions')->count());
        $this->assertSame(0, DB::table('communication_messages')->count());
        $this->assertSame(0, DailyBeneficiary::count());

        $this->post('/api/smart-import/beneficiaries', [
            'target' => 'daily',
            'reviewed_confirmation' => true,
            'file' => $this->csv("full_name,national_id,phone,district,nationality\nTEST DAILY,1234567801,0502222222,العزيزية,يمني\n"),
            'mapping' => json_encode([
                'full_name' => 'full_name',
                'national_id' => 'national_id',
                'phone' => 'phone',
                'district' => 'district',
                'nationality' => 'nationality',
            ]),
        ], ['Accept' => 'application/json'])->assertOk()->assertJsonPath('created', 1);

        $this->assertDatabaseHas('daily_beneficiaries', [
            'national_id' => '1234567801',
            'nationality' => 'يمني',
            'beneficiary_type' => 'resident',
        ]);
        $this->assertSame(0, BeneficiaryPolicyEvaluation::count());
        $this->assertSame(0, DB::table('daily_receiving_transactions')->count());
    }

    public function test_unified_list_uses_one_grouped_completed_receipt_query(): void
    {
        $first = $this->beneficiary('FIRST RECEIPTS', 'سعودي', 'citizen');
        $second = $this->beneficiary('SECOND RECEIPT', 'يمني', 'resident');
        $unserved = $this->beneficiary('NO RECEIPT', 'سعودي', 'citizen');
        $daily = DailyBeneficiary::create([
            'full_name' => 'DAILY SERVED',
            'national_id' => '1234567811',
            'phone' => '0503333331',
            'district' => 'العزيزية',
            'status' => 'active',
            'nationality' => 'سعودي',
            'beneficiary_type' => 'citizen',
        ]);
        $missing = DailyBeneficiary::create([
            'full_name' => 'DAILY MISSING NATIONALITY',
            'national_id' => '1234567812',
            'phone' => '0503333332',
            'district' => 'الششة',
            'status' => 'active',
        ]);

        $this->receipt($first->id, '2026-03-01 12:00:00', 'أرز', '2.00', 'كجم');
        $latestId = $this->receipt($first->id, '2026-04-01 12:00:00', 'تمر', '1.00', 'كرتون');
        $this->receipt($second->id, '2026-02-01 12:00:00', 'زيت', '1.00', 'لتر');
        $draftId = (string) Str::uuid();
        DB::table('support_distributions')->insert([
            'id' => $draftId,
            'recipient_type' => 'beneficiary',
            'beneficiary_id' => $unserved->id,
            'recipient_name' => 'NO RECEIPT',
            'fulfillment_method' => 'pickup',
            'status' => 'draft',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        DB::table('support_receipts')->insert([
            'id' => (string) Str::uuid(),
            'support_distribution_id' => $draftId,
            'confirmed_by' => $this->admin->id,
            'confirmed_at' => '2026-04-02 12:00:00',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $dailyItem = (string) Str::uuid();
        DB::table('daily_inventory_items')->insert([
            'id' => $dailyItem,
            'name' => 'سلة',
            'unit' => 'سلة',
            'current_quantity' => 5,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $transactionId = (string) Str::uuid();
        DB::table('daily_receiving_transactions')->insert([
            'id' => $transactionId,
            'document_number' => 'DOC-NAT-1',
            'daily_beneficiary_id' => $daily->id,
            'daily_inventory_item_id' => $dailyItem,
            'basket_type_name' => 'سلة غذائية',
            'quantity' => 3,
            'status' => 'received',
            'receiving_date' => '2026-05-02 08:00:00',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        DB::table('daily_receiving_transactions')->insert([
            'id' => (string) Str::uuid(),
            'document_number' => 'DOC-NAT-2',
            'daily_beneficiary_id' => $missing->id,
            'daily_inventory_item_id' => $dailyItem,
            'basket_type_name' => 'ملغاة',
            'quantity' => 9,
            'status' => 'cancelled',
            'receiving_date' => '2026-05-03 08:00:00',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::flushQueryLog();
        DB::enableQueryLog();
        $response = $this->getJson('/api/beneficiaries/unified?tab=all&per_page=100')->assertOk();
        $queries = array_column(DB::getQueryLog(), 'query');
        DB::disableQueryLog();

        $receiptQueries = array_values(array_filter($queries, fn ($sql) => str_contains($sql, 'support_receipts')));
        $dailyQueries = array_values(array_filter($queries, fn ($sql) => str_contains($sql, 'daily_receiving_transactions')));
        $this->assertLessThanOrEqual(3, count($receiptQueries));
        $this->assertLessThanOrEqual(3, count($dailyQueries));
        $this->assertGreaterThanOrEqual(2, count($receiptQueries));

        $rows = collect($response->json('data.data'));
        $firstRow = $rows->firstWhere('id', $first->id);
        $this->assertSame(2, $firstRow['completed_receipt_count']);
        $this->assertSame($latestId, $firstRow['latest_completed_receipt']['id']);
        $this->assertStringContainsString('2026-04-01', $firstRow['latest_completed_receipt']['completed_at']);
        $this->assertStringContainsString('تمر', $firstRow['latest_completed_receipt']['summary']);
        $this->assertSame('citizen', $firstRow['beneficiary_type']);
        $this->assertSame('permanent', $firstRow['source']);

        $secondRow = $rows->firstWhere('id', $second->id);
        $this->assertSame(1, $secondRow['completed_receipt_count']);
        $this->assertSame('resident', $secondRow['beneficiary_type']);

        $unservedRow = $rows->firstWhere('id', $unserved->id);
        $this->assertSame(0, $unservedRow['completed_receipt_count']);
        $this->assertNull($unservedRow['latest_completed_receipt']);

        $dailyRow = $rows->firstWhere('id', $daily->id);
        $this->assertSame('daily', $dailyRow['source']);
        $this->assertSame('citizen', $dailyRow['beneficiary_type']);
        $this->assertSame(1, $dailyRow['completed_receipt_count']);
        $this->assertSame($transactionId, $dailyRow['latest_completed_receipt']['id']);
        $this->assertStringContainsString('سلة غذائية', $dailyRow['latest_completed_receipt']['summary']);
        $this->assertNull($dailyRow['address']);
        $this->assertNull($dailyRow['family_status']);

        $missingOnly = $this->getJson('/api/beneficiaries/unified?tab=daily&nationality_missing=1')->assertOk();
        $missingIds = collect($missingOnly->json('data.data'))->pluck('id')->all();
        $this->assertContains($missing->id, $missingIds);
        $this->assertNotContains($daily->id, $missingIds);

        $saudiOnly = $this->getJson('/api/beneficiaries/unified?tab=all&nationality='.rawurlencode('سعودي'))->assertOk();
        $saudiIds = collect($saudiOnly->json('data.data'))->pluck('id')->all();
        $this->assertNotContains($missing->id, $saudiIds);
        $this->assertContains($daily->id, $saudiIds);
    }

    public function test_soft_deleted_daily_beneficiary_stays_off_the_unified_list_and_is_skipped_on_import(): void
    {
        $deleted = DailyBeneficiary::create([
            'full_name' => 'TEST deleted daily',
            'national_id' => '1555555501',
            'phone' => '0505555501',
            'district' => 'العزيزية',
            'status' => 'active',
            'nationality' => 'سعودي',
            'beneficiary_type' => 'citizen',
        ]);
        $deleted->delete();
        $visible = DailyBeneficiary::create([
            'full_name' => 'TEST visible daily',
            'national_id' => '1555555502',
            'phone' => '0505555502',
            'district' => 'العزيزية',
            'status' => 'active',
            'nationality' => 'يمني',
            'beneficiary_type' => 'resident',
        ]);

        $rows = collect($this->getJson('/api/beneficiaries/unified?tab=daily&per_page=100')->assertOk()->json('data.data'));
        $this->assertFalse($rows->contains('id', $deleted->id));
        $this->assertTrue($rows->contains('id', $visible->id));
        $this->assertSoftDeleted('daily_beneficiaries', ['id' => $deleted->id]);

        $this->post('/api/smart-import/beneficiaries', [
            'target' => 'daily',
            'reviewed_confirmation' => true,
            'file' => $this->csv("full_name,national_id,phone,district,nationality\nTEST deleted daily,1555555501,0505555501,العزيزية,سعودي\nTEST new daily,1555555503,0505555503,العزيزية,يمني\n"),
            'mapping' => json_encode([
                'full_name' => 'full_name',
                'national_id' => 'national_id',
                'phone' => 'phone',
                'district' => 'district',
                'nationality' => 'nationality',
            ]),
        ], ['Accept' => 'application/json'])->assertOk()
            ->assertJsonPath('created', 1)
            ->assertJsonPath('skipped', 1)
            ->assertJsonPath('failed', 0);

        $this->assertSoftDeleted('daily_beneficiaries', ['id' => $deleted->id]);
        $this->assertSame(0, DailyBeneficiary::where('national_id', '1555555501')->count());
        $this->assertSame(1, DailyBeneficiary::withTrashed()->where('national_id', '1555555501')->count());
        $this->assertDatabaseHas('daily_beneficiaries', [
            'national_id' => '1555555503',
            'nationality' => 'يمني',
            'beneficiary_type' => 'resident',
            'deleted_at' => null,
        ]);
    }

    private function permanentPayload(array $overrides = []): array
    {
        return array_merge([
            'reviewed_confirmation' => true,
            'full_name' => 'مستفيد دائم',
            'national_id' => '1000000200',
            'phone' => '0500000200',
            'city' => 'مكة',
            'district' => 'العزيزية',
            'street' => 'شارع الاختبار',
            'date_of_birth' => '1990-01-01',
            'family_status' => 'poor',
            'family_members_count' => 1,
            'housing_type' => 'own',
            'status' => 'active',
            'nationality' => 'سعودي',
        ], $overrides);
    }

    private function dailyPayload(array $overrides = []): array
    {
        return array_merge([
            'reviewed_confirmation' => true,
            'full_name' => 'مستفيد يومي',
            'national_id' => '1234567890',
            'phone' => '0501234567',
            'district' => 'العزيزية',
            'nationality' => 'سعودي',
        ], $overrides);
    }

    private function csv(string $content): UploadedFile
    {
        return UploadedFile::fake()->createWithContent('beneficiaries.csv', "\xEF\xBB\xBF".$content);
    }

    private function beneficiary(string $name, string $nationality, string $type): Beneficiary
    {
        return Beneficiary::create([
            'full_name' => $name,
            'national_id' => '19'.str_pad((string) random_int(0, 99999999), 8, '0', STR_PAD_LEFT),
            'phone' => '050'.str_pad((string) random_int(0, 9999999), 7, '0', STR_PAD_LEFT),
            'beneficiary_type' => $type,
            'nationality' => $nationality,
            'status' => 'active',
            'city' => 'مكة',
            'district' => 'العزيزية',
            'street' => 'شارع',
            'family_status' => 'poor',
        ]);
    }

    private function receipt(string $beneficiaryId, string $completedAt, string $name, string $quantity, string $unit): string
    {
        $distributionId = (string) Str::uuid();
        $itemId = (string) Str::uuid();
        DB::table('inventory_items')->insert([
            'id' => $itemId,
            'name' => $name,
            'unit' => $unit,
            'current_quantity' => 10,
            'min_threshold' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        DB::table('support_distributions')->insert([
            'id' => $distributionId,
            'recipient_type' => 'beneficiary',
            'beneficiary_id' => $beneficiaryId,
            'recipient_name' => 'TEST',
            'fulfillment_method' => 'pickup',
            'status' => 'completed',
            'completed_at' => $completedAt,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        DB::table('support_receipts')->insert([
            'id' => (string) Str::uuid(),
            'support_distribution_id' => $distributionId,
            'confirmed_by' => $this->admin->id,
            'confirmed_at' => $completedAt,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        DB::table('support_distribution_items')->insert([
            'id' => (string) Str::uuid(),
            'support_distribution_id' => $distributionId,
            'inventory_item_id' => $itemId,
            'requested_quantity' => $quantity,
            'reserved_quantity' => $quantity,
            'fulfilled_quantity' => $quantity,
            'unit_snapshot' => $unit,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return $distributionId;
    }
}
