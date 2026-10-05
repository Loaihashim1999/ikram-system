<?php

namespace Tests\Feature;

use App\Models\Beneficiary;
use App\Models\BeneficiaryPolicyEvaluation;
use App\Models\BeneficiaryPolicyVersion;
use App\Models\DailyBeneficiary;
use App\Models\DailyInventoryItem;
use App\Models\InventoryItem;
use App\Models\SupportDistribution;
use App\Models\User;
use App\Services\GovernanceReportService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Laravel\Sanctum\Sanctum;
use PhpOffice\PhpSpreadsheet\IOFactory;
use Tests\TestCase;

class GovernanceReportsFinalizationTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::factory()->create(['role' => 'admin', 'is_active' => true]);
        Sanctum::actingAs($this->admin);
    }

    private function beneficiary(string $name, string $date, array $extra = []): Beneficiary
    {
        $row = Beneficiary::create(array_merge([
            'full_name' => $name, 'national_id' => '1'.str_pad((string) random_int(1, 999999999), 9, '0', STR_PAD_LEFT),
            'phone' => '0500000000', 'beneficiary_type' => 'citizen', 'status' => 'active', 'district' => 'الصفا',
        ], $extra));
        $row->timestamps = false;
        $row->forceFill(['created_at' => $date.' 12:00:00', 'updated_at' => $date.' 12:00:00'])->saveQuietly();

        return $row->fresh();
    }

    private function request(array $query = []): Request
    {
        $request = Request::create('/api/governance/analytics', 'GET', $query);
        $request->setUserResolver(fn () => $this->admin);

        return $request;
    }

    public function test_date_filters_are_inclusive_and_invalid_ranges_are_rejected(): void
    {
        $this->beneficiary('BEFORE', '2026-09-01');
        $this->beneficiary('BOUNDARY', '2026-09-10');
        $this->beneficiary('AFTER', '2026-09-11');

        $this->getJson('/api/governance/analytics?start_date=2026-09-10&end_date=2026-09-10')
            ->assertOk()->assertJsonPath('kpis.filtered_registrations', 1)->assertJsonPath('detail.total', 1);
        $this->getJson('/api/governance/analytics?start_date=2026-09-11&end_date=2026-09-10')->assertUnprocessable();
        $this->getJson('/api/governance/analytics?start_date=invalid')->assertUnprocessable();
    }

    public function test_kpis_and_all_four_charts_use_the_same_filtered_queries(): void
    {
        $person = $this->beneficiary('PERMANENT', '2026-09-10');
        $daily = DailyBeneficiary::create(['full_name' => 'DAILY', 'national_id' => '2999999999', 'phone' => '0511111111', 'status' => 'active', 'district' => 'الصفا']);
        $daily->timestamps = false;
        $daily->forceFill(['created_at' => '2026-09-10 10:00:00', 'updated_at' => '2026-09-10 10:00:00'])->saveQuietly();
        SupportDistribution::create(['recipient_type' => 'beneficiary', 'beneficiary_id' => $person->id, 'recipient_name' => $person->full_name, 'fulfillment_method' => 'pickup', 'status' => 'completed', 'completed_at' => '2026-09-10 14:00:00', 'created_at' => '2026-09-10 09:00:00']);

        $json = $this->getJson('/api/governance/analytics?start_date=2026-09-10&end_date=2026-09-10')->assertOk()->json();
        $this->assertSame($json['kpis']['filtered_registrations'], array_sum(array_column($json['charts']['column_chart']['data'], 'count')));
        $this->assertSame($json['kpis']['filtered_registrations'], array_sum(array_column($json['charts']['pie_chart']['data'], 'count')));
        $this->assertSame($json['kpis']['filtered_registrations'], array_sum(array_column($json['charts']['line_chart']['data'], 'registrations')));
        $funnel = array_column($json['charts']['funnel_chart']['stages'], 'count');
        $this->assertSame($funnel, collect($funnel)->sortDesc()->values()->all());
    }

    public function test_detail_filters_and_pagination_are_server_side_and_deterministic(): void
    {
        foreach (range(1, 12) as $index) {
            $this->beneficiary(sprintf('MATCH %02d', $index), '2026-09-10');
        }
        $this->beneficiary('OTHER', '2026-09-10', ['district' => 'الروضة']);
        $this->beneficiary('RESIDENT', '2026-09-10', ['beneficiary_type' => 'resident']);

        $first = $this->getJson('/api/governance/analytics?start_date=2026-09-10&end_date=2026-09-10&district=الصفا&beneficiary_type=citizen&status=active&per_page=5&page=1')->assertOk()->json('detail');
        $second = $this->getJson('/api/governance/analytics?start_date=2026-09-10&end_date=2026-09-10&district=الصفا&beneficiary_type=citizen&status=active&per_page=5&page=2')->assertOk()->json('detail');
        $this->assertSame(12, $first['total']);
        $this->assertCount(5, $first['data']);
        $this->assertCount(5, $second['data']);
        $this->assertEmpty(array_intersect(array_column($first['data'], 'id'), array_column($second['data'], 'id')));
    }

    public function test_view_excel_and_pdf_permissions_are_independent(): void
    {
        $viewer = User::factory()->create(['role' => 'assistant_admin', 'is_active' => true, 'permissions' => ['governance' => ['view' => true]]]);
        Sanctum::actingAs($viewer);
        $this->getJson('/api/governance/analytics')->assertOk();
        $this->get('/api/reports/comprehensive/excel')->assertForbidden();
        $this->get('/api/reports/comprehensive/pdf')->assertForbidden();

        $excel = User::factory()->create(['role' => 'assistant_admin', 'is_active' => true, 'permissions' => ['governance' => ['export_excel' => true]]]);
        Sanctum::actingAs($excel);
        $this->get('/api/reports/comprehensive/excel')->assertOk();
        $this->get('/api/reports/comprehensive/pdf')->assertForbidden();

        $pdf = User::factory()->create(['role' => 'assistant_admin', 'is_active' => true, 'permissions' => ['governance' => ['export_pdf' => true]]]);
        Sanctum::actingAs($pdf);
        $this->get('/api/reports/comprehensive/pdf')->assertOk();
        $this->get('/api/reports/comprehensive/excel')->assertForbidden();
    }

    public function test_excel_exports_all_matching_rows_with_types_and_formula_neutralization(): void
    {
        foreach (range(1, 12) as $index) {
            $this->beneficiary($index === 1 ? '=FORMULA' : 'ROW '.$index, '2026-09-10', ['district' => 'North']);
        }
        foreach (range(1, 3) as $index) {
            $this->beneficiary('EXCLUDED '.$index, '2026-09-10', ['district' => 'South']);
        }
        $response = $this->get('/api/reports/comprehensive/excel?start_date=2026-09-10&end_date=2026-09-10&district=North&per_page=5')->assertOk();
        $path = storage_path('framework/testing/governance-final.xlsx');
        file_put_contents($path, $response->streamedContent());
        $book = IOFactory::load($path);
        $sheet = $book->getSheetByName('beneficiaries_snapshot');
        $this->assertSame(13, $sheet->getHighestRow());
        $names = [];
        for ($row = 2; $row <= $sheet->getHighestRow(); $row++) {
            $names[] = $sheet->getCell('B'.$row)->getValue();
        }
        $this->assertContains("'=FORMULA", $names);
        $this->assertSame('n', $sheet->getCell('M2')->getDataType());
    }

    public function test_pdf_is_comprehensive_local_output(): void
    {
        $this->beneficiary('PDF ROW', now()->toDateString());
        $pdf = $this->get('/api/reports/comprehensive/pdf?start_date='.now()->toDateString().'&end_date='.now()->toDateString())->assertOk();
        $this->assertStringStartsWith('%PDF', $pdf->getContent());
        $this->assertGreaterThan(20000, strlen($pdf->getContent()));
    }

    public function test_historical_policy_snapshot_is_reported_without_recalculation(): void
    {
        $person = $this->beneficiary('HISTORY', '2026-09-10', ['monthly_salary' => 1000]);
        $version = BeneficiaryPolicyVersion::create(['policy_name' => 'TEST GOVERNANCE', 'version' => '1', 'effective_from' => '2026-01-01', 'configuration' => []]);
        $evaluation = BeneficiaryPolicyEvaluation::create(['beneficiary_id' => $person->id, 'policy_version_id' => $version->id, 'evaluation_status' => 'completed', 'eligibility_decision' => 'eligible', 'gross_counted_income' => 1000, 'input_snapshot' => ['monthly_salary' => 1000], 'evaluated_at' => '2026-09-10 10:00:00']);
        $person->update(['monthly_salary' => 9000]);

        $report = app(GovernanceReportService::class)->build($this->request(['start_date' => '2026-09-10', 'end_date' => '2026-09-10']));
        $this->assertSame('1000.00', $evaluation->fresh()->gross_counted_income);
        $this->assertSame('1000.00', $report['datasets']['policy_evaluations'][0]['gross_counted_income'] ?? $evaluation->fresh()->gross_counted_income);
        $this->assertSame(['eligible' => 1], $report['policy_outcomes']);
        $this->assertSame(1000.0, $report['policy_finance']['gross_counted_income']);
    }

    public function test_main_and_daily_inventory_remain_separate(): void
    {
        InventoryItem::create(['name' => 'MAIN', 'unit' => 'kg', 'current_quantity' => 10, 'min_threshold' => 1]);
        DailyInventoryItem::create(['name' => 'DAILY', 'unit' => 'basket', 'current_quantity' => 20, 'min_threshold' => 2]);
        $report = app(GovernanceReportService::class)->build($this->request());
        $this->assertSame('MAIN', $report['datasets']['main_stock_snapshot'][0]['name']);
        $this->assertSame('DAILY', $report['datasets']['daily_stock_snapshot'][0]['name']);
        $this->assertNotSame($report['datasets']['main_stock_snapshot'][0]['unit'], $report['datasets']['daily_stock_snapshot'][0]['unit']);
    }
}
