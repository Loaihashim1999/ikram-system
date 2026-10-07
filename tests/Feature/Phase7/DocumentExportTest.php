<?php

namespace Tests\Feature\Phase7;

use App\Models\Beneficiary;
use App\Models\Driver;
use App\Models\SupportDistribution;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\IOFactory;
use Tests\TestCase;

class DocumentExportTest extends TestCase
{
    use RefreshDatabase;

    public function test_exports_are_localized_complete_and_keep_identifiers_as_text(): void
    {
        $admin = User::create([
            'username' => 'TEST_export_'.Str::random(8), 'full_name' => 'مصدّر الوثائق',
            'password' => 'test-password', 'role' => 'admin', 'permissions' => [], 'is_active' => true,
        ]);
        $beneficiary = Beneficiary::create([
            'full_name' => 'مستفيد التصدير', 'national_id' => '1057491715', 'phone' => '0501111000',
            'beneficiary_type' => 'citizen', 'status' => 'active', 'city' => 'مكة', 'district' => 'العزيزية',
        ]);
        Driver::create(['full_name' => 'سائق معطّل', 'phone' => '966574917155', 'is_active' => false]);
        foreach (['completed', 'ready', 'cancelled'] as $status) {
            SupportDistribution::create([
                'recipient_type' => 'beneficiary', 'beneficiary_id' => $beneficiary->id,
                'recipient_name' => 'مستفيد التصدير', 'recipient_reference' => 'REF-EXPORT',
                'fulfillment_method' => 'pickup', 'status' => $status, 'support_date' => now()->toDateString(),
            ]);
        }
        $this->getJson('/api/documents/drivers/excel')->assertUnauthorized();
        Sanctum::actingAs($admin);

        $workbook = $this->workbook($this->get('/api/beneficiaries/unified/export'));
        $sheet = $workbook->getSheetByName('المستفيدون');
        $this->assertNotNull($sheet, implode('|', $workbook->getSheetNames()));
        $this->assertSame('مواطن', $sheet->getCell('C2')->getValue());
        $this->assertSame('نشط', $sheet->getCell('F2')->getValue());
        $this->assertStringNotContainsString('citizen', $workbook->getActiveSheet()->getCell('A1')->getValue().$sheet->getCell('C2')->getValue());

        $drivers = $this->workbook($this->get('/api/documents/drivers/excel'))->getSheetByName('السائقون');
        $this->assertSame('0574917155', $drivers->getCell('B2')->getValue());
        $this->assertSame(DataType::TYPE_STRING, $drivers->getCell('B2')->getDataType());
        $this->assertSame('معطّل', $drivers->getCell('C2')->getValue());
        $this->assertStringNotContainsString('delivery_driver', $drivers->getCell('A2')->getValue());

        $governance = $this->workbook($this->get('/api/reports/comprehensive/excel'));
        $this->assertSame('تقرير الحوكمة', $governance->getSheetByName('الغلاف')->getCell('A2')->getValue());
        $beneficiaries = $governance->getSheetByName('المستفيدون');
        $this->assertSame('الاسم', $beneficiaries->getCell('B1')->getValue());
        $this->assertSame('صفة المستفيد', $beneficiaries->getCell('C1')->getValue());
        $this->assertSame('مواطن', (string) $beneficiaries->getCell('C2')->getValue());
        $this->assertSame(DataType::TYPE_STRING, $beneficiaries->getCell('A2')->getDataType());
        foreach ($governance->getAllSheets() as $exported) {
            $this->assertStringNotContainsString('No matching records', (string) $exported->getCell('A1')->getValue());
        }

        $page = $this->getJson('/api/support/distributions?beneficiary_id='.$beneficiary->id.'&per_page=1&fulfillment_method=pickup');
        $page->assertOk();
        $this->assertCount(1, $page->json('data'));
        $this->assertSame(3, $page->json('last_page'));
        $complete = $this->getJson('/api/support/distributions?beneficiary_id='.$beneficiary->id.'&per_page=-1&all=1&fulfillment_method=pickup&status=completed');
        $complete->assertOk();
        $this->assertCount(1, $complete->json('data'));
        $this->assertSame('completed', $complete->json('data.0.status'));
        $all = $this->getJson('/api/support/distributions?beneficiary_id='.$beneficiary->id.'&per_page=-1&all=1&fulfillment_method=pickup');
        $this->assertCount(3, $all->json('data'));
    }

    private function workbook($response)
    {
        $response->assertOk();
        $path = storage_path('app/excel-tests-'.Str::uuid().'.xlsx');
        file_put_contents($path, method_exists($response, 'streamedContent') ? $response->streamedContent() : $response->getContent());
        $workbook = IOFactory::load($path);
        unlink($path);

        return $workbook;
    }
}
