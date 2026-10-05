<?php

namespace Tests\Feature;

use App\Models\Basket;
use App\Models\Beneficiary;
use App\Models\BeneficiaryPolicyEvaluation;
use App\Models\BeneficiaryPolicyVersion;
use App\Models\DailyBeneficiary;
use App\Models\DailyInventoryItem;
use App\Models\DailyReceivingTransaction;
use App\Models\Distribution;
use App\Models\InventoryItem;
use App\Models\NeighborhoodRep;
use App\Models\PolicyDecision;
use App\Models\Staff;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Symfony\Component\Process\Process;
use Tests\TestCase;

class PdfFinalizationTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private Beneficiary $beneficiary;

    private Basket $basket;

    private Distribution $distribution;

    private DailyReceivingTransaction $dailyTransaction;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = $this->user('admin');
        $this->beneficiary = Beneficiary::create([
            'full_name' => 'مستفيد PDF طويل Mixed English Name',
            'national_id' => '7555555555',
            'phone' => '0505555555',
            'beneficiary_type' => 'citizen',
            'status' => 'active',
            'city' => 'مكة المكرمة',
            'district' => 'حي اختبار PDF',
            'street' => str_repeat('عنوان عربي طويل للاختبار ', 4),
            'family_members_count' => 4,
            'housing_type' => 'rent',
            'annual_rent_amount' => 12000,
            'monthly_salary' => 9999.99,
        ]);
        $this->basket = Basket::create(['name' => 'سلة PDF أساسية', 'stock_quantity' => 500]);
        $this->distribution = Distribution::create([
            'beneficiary_id' => $this->beneficiary->id,
            'basket_id' => $this->basket->id,
            'assigned_by' => $this->admin->id,
            'scheduled_at' => now(),
            'delivered_at' => now(),
            'barcode_code' => 'RECEIPT_SECRET_PDF',
            'status' => 'delivered',
        ]);

        $daily = DailyBeneficiary::create([
            'full_name' => '<img src="https://remote.invalid/a.png"> اسم يومي آمن',
            'national_id' => '7444444444',
            'phone' => '0504444444',
            'district' => 'حي يومي',
            'status' => 'active',
        ]);
        $dailyItem = DailyInventoryItem::create([
            'name' => 'DAILY_ONLY_ITEM', 'unit' => 'سلة', 'current_quantity' => 20, 'min_threshold' => 1,
        ]);
        $this->dailyTransaction = DailyReceivingTransaction::create([
            'document_number' => 'PDF-DAY-001',
            'daily_beneficiary_id' => $daily->id,
            'daily_inventory_item_id' => $dailyItem->id,
            'basket_type_name' => 'DAILY_ONLY_ITEM',
            'quantity' => 2,
            'status' => 'received',
            'receiving_date' => now(),
            'authorized_user_id' => $this->admin->id,
            'notes' => '<script>REMOTE_SECRET</script> ملاحظات عربية طويلة '.str_repeat('آمنة ', 30),
        ]);
        InventoryItem::create(['name' => 'GENERAL_ONLY_ITEM', 'unit' => 'kg', 'current_quantity' => 30, 'min_threshold' => 1]);
    }

    private function user(string $role, array $permissions = []): User
    {
        return User::create([
            'username' => 'TEST_pdf_'.Str::random(10),
            'full_name' => 'TEST PDF Actor',
            'password' => 'test-password',
            'role' => $role,
            'permissions' => $permissions,
            'is_active' => true,
        ]);
    }

    private function assertPdf($response, string $filename): string
    {
        $response->assertOk()->assertHeader('Content-Type', 'application/pdf');
        $this->assertSame('nosniff', $response->headers->get('X-Content-Type-Options'));
        $this->assertStringContainsString('no-store', $response->headers->get('Cache-Control'));
        $this->assertMatchesRegularExpression('/^(inline|attachment); filename="[A-Za-z0-9._-]+\.pdf"$/', $response->headers->get('Content-Disposition'));
        $bytes = $response->getContent();
        $this->assertStringStartsWith('%PDF-', $bytes);
        $this->assertGreaterThan(5000, strlen($bytes));

        $dir = storage_path('app/pdf-tests');
        if (! is_dir($dir)) {
            mkdir($dir, 0750, true);
        }
        $path = $dir.'/'.Str::uuid().'.pdf';
        file_put_contents($path, $bytes);

        $outputDir = getenv('PDF_ACCEPTANCE_OUTPUT_DIR');
        $acceptanceFiles = ['beneficiary-policy.pdf', 'support-voucher.pdf', 'daily-pickup.pdf', 'multi-page-history.pdf'];
        if ($outputDir && in_array($filename, $acceptanceFiles, true)) {
            if (! is_dir($outputDir)) {
                mkdir($outputDir, 0750, true);
            }
            file_put_contents(rtrim($outputDir, '\\/').'/'.$filename, $bytes);
        }

        return $path;
    }

    private function pdfText(string $path): string
    {
        $process = new Process(['pdftotext', '-enc', 'UTF-8', $path, '-']);
        $process->run();
        $this->assertTrue($process->isSuccessful(), $process->getErrorOutput());

        return $process->getOutput();
    }

    private function pageCount(string $path): int
    {
        $process = new Process(['pdfinfo', $path]);
        $process->run();
        $this->assertTrue($process->isSuccessful(), $process->getErrorOutput());
        preg_match('/^Pages:\s+(\d+)/m', $process->getOutput(), $matches);

        return (int) ($matches[1] ?? 0);
    }

    public function test_guest_unauthorized_and_cross_domain_access_are_denied(): void
    {
        $this->get('/api/documents/beneficiary/'.$this->beneficiary->id.'/pdf')->assertUnauthorized();

        $unauthorized = $this->user('assistant_admin', ['beneficiaries' => ['view' => true, 'issue_document' => false]]);
        Sanctum::actingAs($unauthorized);
        $this->get('/api/documents/beneficiary/'.$this->beneficiary->id.'/pdf')->assertForbidden();

        $dailyOnly = $this->user('reception', [
            'daily_beneficiaries' => ['view' => true, 'issue_document' => true],
            'beneficiaries' => ['view' => false, 'issue_document' => false],
        ]);
        Sanctum::actingAs($dailyOnly);
        $this->get('/api/documents/beneficiary/'.$this->beneficiary->id.'/pdf')->assertForbidden();
        $this->get('/api/documents/daily-receiving/'.$this->dailyTransaction->id.'/pdf')->assertOk();
    }

    public function test_all_existing_pdf_routes_remain_compatible_with_safe_headers(): void
    {
        $rep = NeighborhoodRep::create([
            'full_name' => 'مندوب PDF', 'national_id' => '7333333333', 'phone' => '0503333333',
            'district_name' => $this->beneficiary->district, 'beneficiaries_count' => 1, 'status' => 'active',
        ]);
        $staff = Staff::create([
            'name' => 'موظف PDF', 'national_id' => '7222222222', 'phone' => '0502222222',
            'job_title' => 'TEST', 'department' => 'TEST', 'hire_date' => now()->toDateString(), 'status' => 'active',
        ]);
        Sanctum::actingAs($this->admin);
        $routes = [
            ['/api/documents/beneficiary/'.$this->beneficiary->id.'/pdf', 'beneficiary-policy.pdf'],
            ['/api/documents/individual-receipt/'.$this->distribution->id.'/pdf', 'support-voucher.pdf'],
            ['/api/documents/receipt/'.$this->distribution->id.'/pdf', 'compatibility-receipt.pdf'],
            ['/api/documents/total-delivery/'.$this->beneficiary->id.'/pdf', 'beneficiary-history.pdf'],
            ['/api/documents/rep-receipt/'.$rep->id.'/pdf', 'representative-receipt.pdf'],
            ['/api/documents/staff-receipt/'.$staff->id.'/pdf', 'staff-receipt.pdf'],
            ['/api/documents/daily-receiving/'.$this->dailyTransaction->id.'/pdf', 'daily-pickup.pdf'],
            ['/api/reports/daily/pdf?date='.now()->toDateString(), 'daily-report.pdf'],
            ['/api/reports/comprehensive/pdf?start_date='.now()->toDateString().'&end_date='.now()->toDateString(), 'governance-compatibility.pdf'],
        ];
        foreach ($routes as [$route, $filename]) {
            $path = $this->assertPdf($this->get($route), $filename);
            $this->assertGreaterThanOrEqual(1, $this->pageCount($path));
            $previewNames = ['beneficiary-policy.pdf', 'support-voucher.pdf', 'daily-report.pdf', 'governance-compatibility.pdf'];
            if (in_array($filename, $previewNames, true)) {
                $preview = base_path('docs/ui-redesign/pdf-preview');
                if (! is_dir($preview)) {
                    mkdir($preview, 0750, true);
                }
                copy($path, $preview.DIRECTORY_SEPARATOR.$filename);
            }
            unlink($path);
        }
        $this->get('/api/reports/daily/pdf?date=not-a-date')->assertUnprocessable();
    }

    public function test_beneficiary_pdf_uses_immutable_policy_history_and_decision(): void
    {
        $version = BeneficiaryPolicyVersion::create([
            'policy_name' => 'PDF historical policy', 'version' => 'PDF-HIST-V1',
            'policy_scope' => 'citizen_beneficiaries', 'effective_from' => '2026-01-01', 'status' => 'retired',
        ]);
        $evaluation = BeneficiaryPolicyEvaluation::create([
            'beneficiary_id' => $this->beneficiary->id, 'policy_version_id' => $version->id,
            'evaluation_status' => 'completed', 'evaluated_at' => now()->subMonth(),
            'gross_counted_income' => 1111.11, 'monthly_rent' => 222.22, 'family_size' => 4,
            'adjusted_net_household_income' => 777.77, 'net_income_per_capita' => 194.44,
            'income_category' => 'financially_excluded', 'policy_score' => 33, 'score_category' => 'A',
        ]);
        PolicyDecision::create([
            'evaluation_id' => $evaluation->id, 'policy_version_id' => $version->id,
            'decision' => 'approved', 'decided_by' => $this->admin->id, 'decided_at' => now()->subDays(20),
            'stable_reason_code' => 'PDF_OLD_DECISION', 'human_readable_reason' => 'PDF_DECISION_OLD',
        ]);
        $this->beneficiary->update(['monthly_salary' => 9999.99]);

        Sanctum::actingAs($this->admin);
        $path = $this->assertPdf($this->get('/api/documents/beneficiary/'.$this->beneficiary->id.'/pdf'), 'beneficiary-policy.pdf');
        $text = $this->pdfText($path);
        $this->assertStringContainsString('PDF-HIST-V1', $text);
        $this->assertStringContainsString('1,111.11', $text);
        $this->assertStringContainsString('PDF_DECISION_OLD', $text);
        $this->assertStringNotContainsString('9,999.99', $text);
        unlink($path);
    }

    public function test_long_multipage_history_repeats_content_without_secrets(): void
    {
        for ($i = 1; $i <= 85; $i++) {
            $basket = Basket::create(['name' => 'سلة طويلة MULTIPAGE '.str_pad((string) $i, 3, '0', STR_PAD_LEFT), 'stock_quantity' => 1]);
            Distribution::create([
                'beneficiary_id' => $this->beneficiary->id, 'basket_id' => $basket->id,
                'assigned_by' => $this->admin->id, 'scheduled_at' => now()->subDays($i),
                'barcode_code' => 'MULTIPAGE_SECRET_'.$i, 'status' => 'delivered', 'delivered_at' => now()->subDays($i),
            ]);
        }
        Sanctum::actingAs($this->admin);
        $path = $this->assertPdf($this->get('/api/documents/total-delivery/'.$this->beneficiary->id.'/pdf'), 'multi-page-history.pdf');
        $this->assertGreaterThan(1, $this->pageCount($path));
        $text = $this->pdfText($path);
        $this->assertStringContainsString('MULTIPAGE 085', $text);
        $this->assertStringNotContainsString('MULTIPAGE_SECRET', $text);
        $this->assertStringNotContainsString('RECEIPT_SECRET_PDF', $text);
        unlink($path);
    }

    public function test_daily_pdf_escapes_html_and_preserves_inventory_separation(): void
    {
        Sanctum::actingAs($this->admin);
        $voucher = $this->assertPdf($this->get('/api/documents/daily-receiving/'.$this->dailyTransaction->id.'/pdf'), 'daily-pickup.pdf');
        $voucherText = $this->pdfText($voucher);
        $this->assertStringContainsString('DAILY_ONLY_ITEM', $voucherText);
        // User HTML is reduced to inert visible text; no remote image URL survives.
        $this->assertStringNotContainsString('remote.invalid', $voucherText);
        $this->assertStringContainsString('REMOTE_SECRET', $voucherText);
        $this->assertStringNotContainsString('storage/app', $voucherText);
        unlink($voucher);

        $report = $this->assertPdf($this->get('/api/reports/daily/pdf?date='.now()->toDateString()), 'daily-report.pdf');
        $reportText = $this->pdfText($report);
        $this->assertStringContainsString('DAILY_ONLY_ITEM', $reportText);
        $this->assertStringNotContainsString('GENERAL_ONLY_ITEM', $reportText);
        $this->assertStringNotContainsString('لحفظ الطعام', $reportText);
        unlink($report);
    }

    public function test_pdf_generation_streams_without_colliding_output_files(): void
    {
        Sanctum::actingAs($this->admin);
        $first = $this->get('/api/documents/individual-receipt/'.$this->distribution->id.'/pdf')->assertOk()->getContent();
        $second = $this->get('/api/documents/individual-receipt/'.$this->distribution->id.'/pdf')->assertOk()->getContent();
        $this->assertStringStartsWith('%PDF-', $first);
        $this->assertStringStartsWith('%PDF-', $second);
        $this->assertFileDoesNotExist(storage_path('app/individual-receipt.pdf'));
        $this->assertSame([], glob(storage_path('app/mpdf/*.pdf')) ?: []);
    }
}
