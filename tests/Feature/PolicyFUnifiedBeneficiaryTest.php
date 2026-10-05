<?php

namespace Tests\Feature;

use App\Models\Beneficiary;
use App\Models\Category;
use App\Models\DailyBeneficiary;
use App\Models\DailyInventoryItem;
use App\Models\InventoryItem;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\IOFactory;
use Tests\TestCase;

class PolicyFUnifiedBeneficiaryTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private Category $category;

    private int $sequence = 0;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::create([
            'username' => 'policy_f_admin', 'full_name' => 'POLICY F ADMIN',
            'password' => Hash::make('password'), 'role' => 'admin', 'is_active' => true,
        ]);
        $this->category = Category::create(['name' => 'POLICY F CATEGORY']);
        Sanctum::actingAs($this->admin);
    }

    public function test_all_permanent_and_daily_tabs_are_query_level_isolated(): void
    {
        $permanent = $this->permanent('PERMANENT ONE');
        $daily = $this->daily('DAILY ONE');

        $this->getJson('/api/beneficiaries/unified?tab=all')->assertOk()
            ->assertJsonPath('data.total', 2)
            ->assertJsonFragment(['id' => $permanent->id, 'source' => 'permanent'])
            ->assertJsonFragment(['id' => $daily->id, 'source' => 'daily']);
        $this->getJson('/api/beneficiaries/unified?tab=permanent')->assertOk()
            ->assertJsonPath('data.total', 1)->assertJsonMissing(['source' => 'daily']);
        $this->getJson('/api/beneficiaries/unified?tab=daily')->assertOk()
            ->assertJsonPath('data.total', 1)->assertJsonMissing(['source' => 'permanent']);
    }

    public function test_server_side_combined_filters_are_null_safe(): void
    {
        $this->permanent('MATCH PERSON', ['city' => 'Riyadh', 'district' => 'North', 'status' => 'active']);
        $this->permanent('WRONG CITY', ['city' => 'Jeddah', 'district' => 'North', 'status' => 'active']);
        $this->daily('MATCH DAILY', ['district' => 'North', 'status' => 'active']);

        $this->getJson('/api/beneficiaries/unified?tab=all&search=MATCH&city=Riyadh&district=North&status=active&beneficiary_type=citizen')
            ->assertOk()->assertJsonPath('data.total', 1)
            ->assertJsonPath('data.data.0.full_name', 'MATCH PERSON');
        $this->getJson('/api/beneficiaries/unified?tab=all&city=Riyadh')
            ->assertOk()->assertJsonPath('data.total', 1)
            ->assertJsonPath('data.data.0.source', 'permanent');
    }

    public function test_filters_preserve_pagination_and_deterministic_order(): void
    {
        for ($i = 1; $i <= 7; $i++) {
            $this->permanent("PAGE MATCH {$i}", ['city' => 'Riyadh']);
        }
        $this->permanent('PAGE OTHER', ['city' => 'Jeddah']);

        $first = $this->getJson('/api/beneficiaries/unified?tab=permanent&city=Riyadh&per_page=3&page=1')
            ->assertOk()->assertJsonPath('data.total', 7)->assertJsonPath('data.last_page', 3)->json('data.data');
        $second = $this->getJson('/api/beneficiaries/unified?tab=permanent&city=Riyadh&per_page=3&page=2')
            ->assertOk()->assertJsonPath('data.total', 7)->json('data.data');
        $this->assertCount(3, $first);
        $this->assertCount(3, $second);
        $this->assertEmpty(array_intersect(array_column($first, 'id'), array_column($second, 'id')));
    }

    public function test_domain_permissions_are_independent_and_export_is_explicit(): void
    {
        $permanentOnly = User::factory()->create(['role' => 'assistant_admin', 'permissions' => [
            'beneficiaries' => ['view' => true, 'export' => true],
            'daily_beneficiaries' => ['view' => false, 'export' => false],
        ]]);
        Sanctum::actingAs($permanentOnly);
        $this->getJson('/api/beneficiaries/unified?tab=permanent')->assertOk();
        $this->getJson('/api/beneficiaries/unified?tab=daily')->assertForbidden();
        $this->getJson('/api/beneficiaries/unified?tab=all')->assertForbidden();

        $dailyOnly = User::factory()->create(['role' => 'staff', 'permissions' => [
            'beneficiaries' => ['view' => false, 'export' => false],
            'daily_beneficiaries' => ['view' => true, 'export' => false],
        ]]);
        Sanctum::actingAs($dailyOnly);
        $this->getJson('/api/beneficiaries/unified?tab=daily')->assertOk();
        $this->get('/api/beneficiaries/unified/export?tab=daily')->assertForbidden();
    }

    public function test_filtered_excel_export_contains_every_match_beyond_visible_page_and_no_sensitive_columns(): void
    {
        for ($i = 1; $i <= 27; $i++) {
            $this->permanent("EXPORT MATCH {$i}", ['city' => 'Riyadh']);
        }
        $this->permanent('EXPORT EXCLUDED', ['city' => 'Jeddah']);

        $response = $this->get('/api/beneficiaries/unified/export?tab=permanent&city=Riyadh&page=1&per_page=5')->assertOk();
        $this->assertStringContainsString('spreadsheetml.sheet', $response->headers->get('Content-Type'));
        $path = tempnam(sys_get_temp_dir(), 'policy-f-xlsx-');
        file_put_contents($path, $response->streamedContent());
        $rows = IOFactory::load($path)->getActiveSheet()->toArray();
        @unlink($path);

        $this->assertCount(28, $rows);
        $this->assertSame(['المصدر', 'الاسم', 'النوع', 'المدينة', 'الحي', 'الحالة', 'تاريخ التسجيل'], $rows[0]);
        $this->assertNotContains('رقم الهوية', $rows[0]);
        $this->assertNotContains('الجوال', $rows[0]);
        $this->assertStringNotContainsString('EXPORT EXCLUDED', json_encode($rows, JSON_UNESCAPED_UNICODE));
    }

    public function test_all_and_daily_exports_are_valid_and_neutralize_formula_cells(): void
    {
        $this->permanent('ARABIC مستفيد', ['city' => 'Riyadh']);
        $this->daily('=HYPERLINK("https://invalid.test","x")', ['district' => 'North']);

        foreach (['all' => 3, 'daily' => 2] as $tab => $expectedRows) {
            $response = $this->get("/api/beneficiaries/unified/export?tab={$tab}")->assertOk();
            $path = tempnam(sys_get_temp_dir(), 'policy-g-xlsx-');
            file_put_contents($path, $response->streamedContent());
            $sheet = IOFactory::load($path)->getActiveSheet();
            @unlink($path);
            $this->assertSame($expectedRows, $sheet->getHighestDataRow());
            $this->assertStringContainsString('الاسم', json_encode($sheet->toArray(), JSON_UNESCAPED_UNICODE));
            if ($tab === 'daily') {
                $this->assertSame(DataType::TYPE_STRING, $sheet->getCell('B2')->getDataType());
                $this->assertSame('=HYPERLINK("https://invalid.test","x")', $sheet->getCell('B2')->getValue());
                $this->assertSame(DataType::TYPE_NUMERIC, $sheet->getCell('G2')->getDataType());
            }
        }
    }

    public function test_unified_reads_do_not_merge_or_mutate_inventory_domains(): void
    {
        $permanent = $this->permanent('DOMAIN PERMANENT');
        $daily = $this->daily('DOMAIN DAILY');
        $dailyItem = DailyInventoryItem::create(['name' => 'DAILY ITEM', 'current_quantity' => 9, 'unit' => 'unit']);
        $mainCount = InventoryItem::query()->count();

        $this->getJson('/api/beneficiaries/unified?tab=all')->assertOk();

        $this->assertDatabaseHas('beneficiaries', ['id' => $permanent->id]);
        $this->assertDatabaseHas('daily_beneficiaries', ['id' => $daily->id]);
        $this->assertSame(9, $dailyItem->fresh()->current_quantity);
        $this->assertSame($mainCount, InventoryItem::query()->count());
    }

    private function permanent(string $name, array $overrides = []): Beneficiary
    {
        $this->sequence++;
        $beneficiary = Beneficiary::create(array_merge([
            'beneficiary_type' => 'citizen', 'full_name' => $name,
            'national_id' => '19'.str_pad((string) $this->sequence, 8, '0', STR_PAD_LEFT),
            'phone' => '05'.str_pad((string) $this->sequence, 8, '0', STR_PAD_LEFT),
            'category_id' => $this->category->id, 'status' => 'active',
            'city' => null, 'district' => null, 'income_sources' => [],
        ], $overrides));
        DB::table('beneficiaries')->where('id', $beneficiary->id)->update(['created_at' => now()->addSeconds($this->sequence)]);

        return $beneficiary->fresh();
    }

    private function daily(string $name, array $overrides = []): DailyBeneficiary
    {
        $this->sequence++;
        $beneficiary = DailyBeneficiary::create(array_merge([
            'full_name' => $name,
            'national_id' => '29'.str_pad((string) $this->sequence, 8, '0', STR_PAD_LEFT),
            'phone' => '06'.str_pad((string) $this->sequence, 8, '0', STR_PAD_LEFT),
            'status' => 'active', 'district' => 'Default District',
        ], $overrides));
        DB::table('daily_beneficiaries')->where('id', $beneficiary->id)->update(['created_at' => now()->addSeconds($this->sequence)]);

        return $beneficiary->fresh();
    }
}
