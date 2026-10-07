<?php

namespace Tests\Feature\Phase2;

use App\Models\Basket;
use App\Models\Beneficiary;
use App\Models\DailyBeneficiary;
use App\Models\DailyInventoryItem;
use App\Models\DailyReceivingTransaction;
use App\Models\Distribution;
use App\Models\InventoryItem;
use App\Models\Staff;
use App\Models\SupportDistribution;
use App\Models\SupportDistributionItem;
use App\Models\SupportReceipt;
use App\Models\User;
use App\Services\GovernanceReportService;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use PhpOffice\PhpSpreadsheet\IOFactory;
use Tests\TestCase;

class NationalityReportAndPdfTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private DailyInventoryItem $dailyItem;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::create([
            'username' => 'ekram-e2e-test-a11',
            'full_name' => 'EKRAM-E2E-TEST report operator',
            'email' => 'ekram-e2e-test-a11@example.invalid',
            'password' => Hash::make('password'),
            'role' => 'admin',
            'is_active' => true,
            'can_receive_notifications' => false,
        ]);
        Sanctum::actingAs($this->admin);
        $this->dailyItem = DailyInventoryItem::create([
            'name' => 'EKRAM-E2E-TEST daily basket',
            'unit' => 'سلة',
            'current_quantity' => 20,
            'min_threshold' => 1,
        ]);
    }

    public function test_nationality_buckets_reconcile_and_pdf_samples_keep_the_official_frame(): void
    {
        $people = $this->seedPopulation();
        $proof = $this->proofSupport($people['p1']);

        $all = $this->analysis('start_date=2026-10-01&end_date=2026-10-05');
        $this->assertReconciled($all);
        $this->assertSame('all', $all['domain']);
        $this->assertSame('غير مسجلة', $all['missing']['label']);
        $this->assertSame(10, $all['populations']['registered']['total']);
        $this->assertSame(9, $all['populations']['active']['total']);
        $this->assertSame(5, $all['populations']['served']['total']);
        $this->assertSame(4, $this->bucket($all, 'registered', 'سعودي')['count']);
        $this->assertSame(3, $this->bucket($all, 'registered', 'سعودي')['permanent']);
        $this->assertSame(1, $this->bucket($all, 'registered', 'سعودي')['daily']);
        $this->assertSame(4, $this->bucket($all, 'registered', 'missing')['count']);
        $this->assertSame(2, $this->bucket($all, 'registered', 'missing')['permanent']);
        $this->assertSame(1, $this->bucket($all, 'registered', 'مصري')['count']);
        $this->assertSame(1, $this->bucket($all, 'registered', 'يمني')['count']);
        $this->assertNull(collect($all['populations']['registered']['buckets'])->firstWhere('key', '  يمني  '));
        $this->assertSame(5, $this->bucket($all, 'active', 'سعودي')['count']);
        $this->assertSame(3, $this->bucket($all, 'active', 'missing')['count']);
        $this->assertSame(1, $this->bucket($all, 'active', 'يمني')['permanent']);
        $this->assertSame(0, $this->bucket($all, 'active', 'يمني')['daily']);
        $this->assertSame(3, $this->bucket($all, 'served', 'سعودي')['count']);
        $this->assertSame(2, $this->bucket($all, 'served', 'سعودي')['permanent']);
        $this->assertSame(1, $this->bucket($all, 'served', 'سعودي')['daily']);
        $this->assertSame(2, $this->bucket($all, 'served', 'يمني')['count']);
        $this->assertSame(0, $this->bucket($all, 'served', 'missing')['count']);
        $this->assertNull($people['d2']->fresh()->nationality);

        $day = $this->analysis('start_date=2026-10-03&end_date=2026-10-03');
        $this->assertReconciled($day);
        $this->assertSame(2, $day['populations']['registered']['total']);
        $this->assertSame(1, $this->bucket($day, 'registered', 'سعودي')['count']);
        $this->assertSame(1, $this->bucket($day, 'registered', 'missing')['count']);
        $this->assertSame(0, $day['populations']['served']['total']);
        $this->assertSame(9, $day['populations']['active']['total']);

        $permanent = $this->analysis('start_date=2026-10-01&end_date=2026-10-05&domain=permanent');
        $this->assertSame(6, $permanent['populations']['registered']['total']);
        $this->assertSame(3, $this->bucket($permanent, 'registered', 'سعودي')['count']);
        $this->assertArrayNotHasKey('daily', $this->bucket($permanent, 'registered', 'سعودي'));
        $daily = $this->analysis('start_date=2026-10-01&end_date=2026-10-05&domain=daily');
        $this->assertSame(4, $daily['populations']['registered']['total']);
        $this->assertSame(1, $this->bucket($daily, 'registered', 'سعودي')['count']);
        $this->assertArrayNotHasKey('permanent', $this->bucket($daily, 'registered', 'سعودي'));

        $scoped = $this->analysis('start_date=2026-10-01&end_date=2026-10-05&search=SCOPE-MARKER');
        $this->assertSame(1, $scoped['populations']['registered']['total']);
        $this->assertSame(1, $scoped['populations']['active']['total']);
        $this->assertSame(1, $scoped['populations']['served']['total']);
        $this->assertSame(0, $this->bucket($scoped, 'registered', 'سعودي')['daily']);

        $analytics = $this->getJson('/api/analytics?start_date=2026-10-01&end_date=2026-10-05')
            ->assertOk()
            ->json('nationality_analysis');
        $this->assertEquals($all, $analytics);

        $report = app(GovernanceReportService::class)->build($this->reportRequest());
        $rows = collect($report['datasets']['nationality_analysis']);
        foreach (['registered', 'active', 'served'] as $population) {
            $this->assertSame($all['populations'][$population]['total'], $rows->where('population', $population)->sum('count'));
        }
        $excel = storage_path('app/mpdf/ekram-e2e-test-nationality.xlsx');
        if (! is_dir(dirname($excel))) {
            mkdir(dirname($excel), 0750, true);
        }
        $excelResponse = $this->get('/api/reports/comprehensive/excel?start_date=2026-10-01&end_date=2026-10-05')->assertOk();
        file_put_contents($excel, $excelResponse->streamedContent());
        $workbook = IOFactory::load($excel);
        $sheet = $workbook->getSheetByName('تحليل الجنسية');
        $this->assertNotNull($sheet, 'sheets: '.implode(',', $workbook->getSheetNames()));
        $exported = 0;
        foreach ($sheet->toArray() as $index => $row) {
            if ($index === 0 || ($row[0] ?? null) !== 'مسجل') {
                continue;
            }
            $exported += (int) $row[3];
        }
        $this->assertSame($all['populations']['registered']['total'], $exported);
        unlink($excel);

        $html = view('pdf.weekly_comprehensive_report', ['report' => $report])->render();
        $this->assertStringContainsString('تحليل الجنسية', $html);
        $this->assertStringNotContainsString('الجنسية — لقطة حالية', $html);
        $this->assertStringContainsString('غير مسجلة', $html);
        $this->assertStringContainsString('مصري', $html);
        $this->assertStringNotContainsString('fonts.googleapis', $html);
        $this->assertStringNotContainsString('11.jpeg', $html);
        $this->assertDoesNotMatchRegularExpression('/https?:\/\//', preg_replace('/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/', '', $html));

        $proofHtml = view('pdf.support_proof', [
            'receipt' => $proof['receipt'],
            'proof' => $proof['snapshot'],
            'legacy' => false,
            'confirmedAt' => Carbon::parse($proof['snapshot']['confirmed_at']),
            'generatedAt' => Carbon::parse('2026-10-05 09:00:00'),
        ])->render();
        foreach ([
            '1', 'رمز الاستلام', $proof['support']->id, 'مستفيد', $people['p1']->id,
            'EKRAM-E2E-TEST SCOPE-MARKER', '0500001101', 'مكة', 'الصفا', 'EKRAM-E2E-TEST street',
            'EKRAM-E2E-TEST pickup', $this->admin->id, 'EKRAM-E2E-TEST report operator',
            'تم الاستلام', $proof['item']->id, 'EKRAM-E2E-TEST rice', '2.50', 'كيلو',
        ] as $value) {
            $this->assertStringContainsString((string) $value, $proofHtml);
        }
        $this->assertStringContainsString('تم الاستلام', $proofHtml);
        $this->assertStringContainsString('طريقة التحقق', $proofHtml);
        $this->assertStringNotContainsString('معرف السائق', $proofHtml);
        $this->assertDoesNotMatchRegularExpression('/رمز الاستلام:\s*[0-9]{4}/', $proofHtml);

        $deliveryHtml = view('pdf.support_proof', [
            'receipt' => $proof['receipt'],
            'proof' => ['fulfillment_method' => 'delivery', 'task_reference' => $proof['support']->id,
                'recipient' => $proof['snapshot']['recipient'],
                'driver' => ['id' => 'driver-1', 'name' => 'EKRAM-E2E-TEST driver', 'assignment_id' => 'assignment-1'],
                'employee' => $proof['snapshot']['employee'], 'confirmed_at' => $proof['snapshot']['confirmed_at'],
                'final_status' => 'completed', 'items' => $proof['snapshot']['items']],
            'legacy' => false,
            'confirmedAt' => Carbon::parse($proof['snapshot']['confirmed_at']),
            'generatedAt' => Carbon::parse('2026-10-05 09:00:00'),
        ])->render();
        $this->assertStringContainsString('driver-1', $deliveryHtml);
        $this->assertStringContainsString('EKRAM-E2E-TEST driver', $deliveryHtml);
        $this->assertStringContainsString('assignment-1', $deliveryHtml);
        $this->assertStringContainsString('تم التوصيل', $deliveryHtml);

        $portrait = $this->get('/api/support/distributions/'.$proof['support']->id.'/proof')->assertOk()->getContent();
        $landscape = $this->get('/api/reports/comprehensive/pdf?start_date=2026-10-01&end_date=2026-10-05')->assertOk()->getContent();
        $this->assertStringStartsWith('%PDF-', $portrait);
        $this->assertStringStartsWith('%PDF-', $landscape);
        $this->assertGreaterThan(8000, strlen($portrait));
        $this->assertGreaterThan(8000, strlen($landscape));
        $this->assertOrientation($portrait, 'P');
        $this->assertOrientation($landscape, 'L');
        $this->assertGreaterThanOrEqual(1, $this->pdfPages($portrait));
        $this->assertGreaterThan(1, $this->pdfPages($landscape));
        $this->assertFileDoesNotExist(storage_path('app/governance-report.pdf'));
        $this->assertFileDoesNotExist(storage_path('app/portrait-support-proof.pdf'));

        $directory = base_path('docs/agentic/phase-2-prompts/evidence/pdf-samples');
        if (! is_dir($directory)) {
            mkdir($directory, 0750, true);
        }
        $portraitPath = $directory.DIRECTORY_SEPARATOR.'portrait-support-proof.pdf';
        $landscapePath = $directory.DIRECTORY_SEPARATOR.'landscape-governance-report.pdf';
        file_put_contents($portraitPath, $portrait);
        file_put_contents($landscapePath, $landscape);
        $this->assertFileExists($portraitPath);
        $this->assertFileExists($landscapePath);
    }

    private function analysis(string $query): array
    {
        $governance = $this->getJson('/api/governance/analytics?'.$query)->assertOk()->json('nationality_analysis');
        $analytics = $this->getJson('/api/analytics?'.$query)->assertOk()->json('nationality_analysis');
        $this->assertEquals($governance, $analytics);

        return $governance;
    }

    private function assertReconciled(array $analysis): void
    {
        foreach ($analysis['chart']['series'] as $series) {
            $this->assertSame($analysis['populations'][$series['key']]['total'], array_sum($series['data']));
            $this->assertCount(count($analysis['chart']['categories']), $series['data']);
        }
        foreach (['registered', 'active', 'served'] as $population) {
            $payload = $analysis['populations'][$population];
            $this->assertSame($payload['total'], array_sum(array_column($payload['buckets'], 'count')));
            $missing = $this->bucket($analysis, $population, 'missing');
            $this->assertSame('غير مسجلة', $missing['label']);
            $this->assertNotSame('غير مسجل', $missing['label']);
            if (isset($missing['permanent'], $missing['daily'])) {
                $this->assertSame($payload['total'], (int) collect($payload['buckets'])->sum(fn (array $row) => $row['permanent'] + $row['daily']));
            }
        }
    }

    private function bucket(array $analysis, string $population, string $key): array
    {
        $bucket = collect($analysis['populations'][$population]['buckets'])->firstWhere('key', $key);
        $this->assertNotNull($bucket, $population.' missing bucket '.$key);

        return $bucket;
    }

    private function reportRequest(): \Illuminate\Http\Request
    {
        $request = \Illuminate\Http\Request::create('/api/governance/analytics', 'GET', [
            'start_date' => '2026-10-01',
            'end_date' => '2026-10-05',
        ]);
        $request->setUserResolver(fn () => $this->admin);

        return $request;
    }

    private function pdfPages(string $bytes): int
    {
        preg_match_all('/\/Type\s*\/Page(?!s)/', $bytes, $matches);

        return count($matches[0]);
    }

    private function assertOrientation(string $bytes, string $orientation): void
    {
        $this->assertSame(1, preg_match('/\/MediaBox\s*\[\s*0(?:\.0+)?\s+0(?:\.0+)?\s+([0-9.]+)\s+([0-9.]+)\s*\]/', $bytes, $box));
        $width = (float) $box[1];
        $height = (float) $box[2];
        $orientation === 'L'
            ? $this->assertGreaterThan($height, $width)
            : $this->assertGreaterThan($width, $height);
    }

    private function seedPopulation(): array
    {
        $p1 = $this->permanent('EKRAM-E2E-TEST SCOPE-MARKER registered', '1900001101', '2026-10-02 12:00:00');
        $p2 = $this->permanent('EKRAM-E2E-TEST october third', '1900001102', '2026-10-03 12:00:00');
        $p3 = $this->permanent('EKRAM-E2E-TEST trimmed yemeni', '1900001103', '2026-09-01 12:00:00', [
            'nationality' => '  يمني  ', 'beneficiary_type' => 'resident',
        ]);
        $p4 = $this->permanent('EKRAM-E2E-TEST citizen without nationality', '1900001104', '2026-10-02 12:00:00', [
            'nationality' => null, 'beneficiary_type' => 'citizen',
        ]);
        $p5 = $this->permanent('EKRAM-E2E-TEST blank suspended', '1900001105', '2026-10-04 12:00:00', [
            'nationality' => '   ', 'status' => 'suspended', 'beneficiary_type' => 'citizen',
        ]);
        $p6 = $this->permanent('EKRAM-E2E-TEST archived served', '1900001106', '2026-10-02 12:00:00', [
            'archived_at' => '2026-10-04 08:00:00',
        ]);
        $p7 = $this->permanent('EKRAM-E2E-TEST under review', '1900001107', '2026-10-01 12:00:00', [
            'nationality' => 'مصري', 'beneficiary_type' => 'resident', 'status' => 'under_review',
        ]);
        $p8 = $this->permanent('EKRAM-E2E-TEST earlier active', '1900001108', '2026-09-15 12:00:00', [
            'confirmed_at' => '2026-10-02 12:00:00',
        ]);
        $employee = $this->permanent('EKRAM-E2E-TEST employee flag', '1900001109', '2026-10-02 12:00:00', [
            'is_employee' => true,
        ]);
        $priorityEmployee = $this->permanent('EKRAM-E2E-TEST employee priority', '1900001110', '2026-10-02 12:00:00');
        $priorityEmployee->forceFill(['priority' => 'employee', 'is_employee' => false])->saveQuietly();

        $d1 = $this->daily('EKRAM-E2E-TEST daily saudi', '1900001101', '2026-10-02 12:00:00', ['nationality' => 'سعودي', 'beneficiary_type' => 'citizen']);
        $d2 = $this->daily('EKRAM-E2E-TEST daily missing', '1900001111', '2026-10-03 12:00:00', ['nationality' => null, 'beneficiary_type' => 'citizen']);
        $d3 = $this->daily('EKRAM-E2E-TEST daily inactive', '1900001112', '2026-10-04 12:00:00', [
            'nationality' => 'يمني', 'beneficiary_type' => 'resident', 'status' => 'inactive',
        ]);
        $d4 = $this->daily('EKRAM-E2E-TEST daily deleted', '1900001113', '2026-10-02 12:00:00');
        $d5 = $this->daily('EKRAM-E2E-TEST daily outside receipt', '1900001114', '2026-09-01 12:00:00');
        $d6 = $this->daily('EKRAM-E2E-TEST daily blank', '1900001115', '2026-10-01 12:00:00', ['nationality' => '   ', 'beneficiary_type' => 'citizen']);

        $this->support($p1, '2026-10-02 13:00:00', true, 2);
        $this->support($p1, '2026-10-02 14:00:00');
        $this->support($p1, '2026-10-02 15:00:00');
        $this->support($p3, '2026-10-04 13:00:00');
        $this->support($p6, '2026-10-05 13:00:00');
        $this->support($employee, '2026-10-02 16:00:00');
        $this->support($p2, '2026-10-02 17:00:00', false);
        $outside = $this->support($p8, '2026-09-20 13:00:00');
        $outside->forceFill([
            'created_at' => '2026-10-03 09:00:00',
            'updated_at' => '2026-10-03 09:00:00',
            'support_date' => '2026-10-03 09:00:00',
        ])->saveQuietly();

        $staff = Staff::create([
            'name' => 'EKRAM-E2E-TEST staff recipient', 'national_id' => '1900001199', 'phone' => '0500001199',
            'job_title' => 'TEST', 'department' => 'TEST', 'hire_date' => '2026-01-01', 'status' => 'active',
        ]);
        $staffSupport = SupportDistribution::create([
            'recipient_type' => 'staff', 'staff_id' => $staff->id, 'recipient_name' => $staff->name,
            'fulfillment_method' => 'pickup', 'status' => 'completed', 'completed_at' => '2026-10-02 18:00:00',
            'created_by' => $this->admin->id,
        ]);
        SupportReceipt::create([
            'support_distribution_id' => $staffSupport->id, 'confirmed_by' => $this->admin->id, 'confirmed_at' => '2026-10-02 18:00:00',
        ]);

        $basket = Basket::create(['name' => 'EKRAM-E2E-TEST legacy basket', 'stock_quantity' => 5]);
        Distribution::create([
            'beneficiary_id' => $p2->id, 'basket_id' => $basket->id, 'assigned_by' => $this->admin->id,
            'scheduled_at' => '2026-10-02 09:00:00', 'delivered_at' => '2026-10-02 09:00:00',
            'barcode_code' => 'EKRAM-E2E-TEST-LEGACY', 'status' => 'delivered',
        ]);

        $this->dailyReceipt($d1, 'EKRAM-E2E-TEST-D1-A', '2026-10-02 10:00:00');
        $this->dailyReceipt($d1, 'EKRAM-E2E-TEST-D1-B', '2026-10-02 11:00:00');
        $this->dailyReceipt($d3, 'EKRAM-E2E-TEST-D3', '2026-10-04 10:00:00');
        $this->dailyReceipt($d4, 'EKRAM-E2E-TEST-D4', '2026-10-02 10:30:00');
        $outsideDaily = $this->dailyReceipt($d5, 'EKRAM-E2E-TEST-D5', '2026-09-15 10:00:00');
        $outsideDaily->forceFill(['created_at' => '2026-10-02 10:00:00', 'updated_at' => '2026-10-02 10:00:00'])->saveQuietly();
        $d4->delete();

        return compact('p1', 'd2');
    }

    private function proofSupport(Beneficiary $beneficiary): array
    {
        $item = InventoryItem::create([
            'name' => 'EKRAM-E2E-TEST rice', 'unit' => 'كيلو', 'current_quantity' => 10, 'min_threshold' => 1,
        ]);
        $support = SupportDistribution::create([
            'recipient_type' => 'beneficiary', 'beneficiary_id' => $beneficiary->id, 'recipient_name' => $beneficiary->full_name,
            'recipient_reference' => 'EKRAM-E2E-TEST-REF', 'fulfillment_method' => 'pickup', 'pickup_location_name' => 'EKRAM-E2E-TEST pickup',
            'status' => 'completed', 'completed_at' => '2026-10-02 13:30:00', 'support_date' => '2026-10-02 13:30:00', 'created_by' => $this->admin->id,
        ]);
        $snapshot = [
            'schema_version' => 1, 'source' => 'confirmation', 'task_reference' => $support->id, 'fulfillment_method' => 'pickup',
            'recipient' => ['type' => 'beneficiary', 'id' => $beneficiary->id, 'display_name' => 'EKRAM-E2E-TEST SCOPE-MARKER',
                'reference' => 'EKRAM-E2E-TEST-REF', 'phone' => '0500001101', 'city' => 'مكة', 'district' => 'الصفا',
                'address' => 'EKRAM-E2E-TEST street', 'full_address' => 'مكة، الصفا، EKRAM-E2E-TEST street'],
            'driver' => null, 'pickup_location' => 'EKRAM-E2E-TEST pickup',
            'employee' => ['id' => $this->admin->id, 'name' => 'EKRAM-E2E-TEST report operator'],
            'confirmed_at' => '2026-10-02T13:30:00+03:00', 'verification_method' => 'receipt_code', 'final_status' => 'completed',
            'items' => [['inventory_item_id' => $item->id, 'name' => 'EKRAM-E2E-TEST rice', 'quantity' => '2.50', 'unit' => 'كيلو']],
        ];
        $receipt = SupportReceipt::create([
            'support_distribution_id' => $support->id, 'confirmed_by' => $this->admin->id,
            'confirmed_at' => '2026-10-02 13:30:00', 'proof_snapshot' => $snapshot,
        ]);

        return compact('support', 'receipt', 'snapshot', 'item');
    }

    private function permanent(string $name, string $nationalId, string $createdAt, array $extra = []): Beneficiary
    {
        $row = Beneficiary::create(array_merge([
            'full_name' => $name, 'national_id' => $nationalId, 'phone' => '05'.substr($nationalId, -8),
            'beneficiary_type' => 'citizen', 'nationality' => 'سعودي', 'status' => 'active', 'district' => 'الصفا',
        ], $extra));
        $this->stamp($row, $createdAt, $extra);

        return $row->fresh();
    }

    private function daily(string $name, string $nationalId, string $createdAt, array $extra = []): DailyBeneficiary
    {
        $row = DailyBeneficiary::create(array_merge([
            'full_name' => $name, 'national_id' => $nationalId, 'phone' => '05'.substr($nationalId, -8),
            'district' => 'الصفا', 'status' => 'active', 'nationality' => 'سعودي', 'beneficiary_type' => 'citizen',
        ], $extra));
        $this->stamp($row, $createdAt, $extra);

        return $row->fresh();
    }

    private function support(Beneficiary $beneficiary, string $completedAt, bool $receipt = true, int $items = 0): SupportDistribution
    {
        $support = SupportDistribution::create([
            'recipient_type' => 'beneficiary', 'beneficiary_id' => $beneficiary->id, 'recipient_name' => $beneficiary->full_name,
            'fulfillment_method' => 'pickup', 'status' => 'completed', 'completed_at' => $completedAt,
            'support_date' => $completedAt, 'created_by' => $this->admin->id,
        ]);
        if ($receipt) {
            SupportReceipt::create([
                'support_distribution_id' => $support->id, 'confirmed_by' => $this->admin->id, 'confirmed_at' => $completedAt,
            ]);
        }
        for ($index = 0; $index < $items; $index++) {
            $stock = InventoryItem::create([
                'name' => 'EKRAM-E2E-TEST item '.$support->id.' '.$index, 'unit' => 'وحدة', 'current_quantity' => 5, 'min_threshold' => 1,
            ]);
            SupportDistributionItem::create([
                'support_distribution_id' => $support->id, 'inventory_item_id' => $stock->id,
                'requested_quantity' => 1, 'reserved_quantity' => 1, 'fulfilled_quantity' => 1, 'unit_snapshot' => 'وحدة',
            ]);
        }

        return $support;
    }

    private function dailyReceipt(DailyBeneficiary $beneficiary, string $number, string $receivedAt): DailyReceivingTransaction
    {
        return DailyReceivingTransaction::create([
            'document_number' => $number, 'daily_beneficiary_id' => $beneficiary->id, 'daily_inventory_item_id' => $this->dailyItem->id,
            'basket_type_name' => 'EKRAM-E2E-TEST daily basket', 'quantity' => 3, 'status' => 'received',
            'receiving_date' => $receivedAt, 'authorized_user_id' => $this->admin->id,
        ]);
    }

    private function stamp(Model $model, string $createdAt, array $extra): void
    {
        $attributes = ['created_at' => $createdAt, 'updated_at' => $createdAt];
        foreach (['archived_at', 'confirmed_at', 'nationality', 'priority', 'is_employee'] as $field) {
            if (array_key_exists($field, $extra)) {
                $attributes[$field] = $extra[$field];
            }
        }
        $model->forceFill($attributes)->saveQuietly();
    }
}
