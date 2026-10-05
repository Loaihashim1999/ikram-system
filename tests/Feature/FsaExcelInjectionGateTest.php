<?php

namespace Tests\Feature;

use App\Models\Beneficiary;
use App\Models\Category;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\IOFactory;
use Tests\TestCase;

/**
 * FSA Section 10 gate: Excel exports must neutralize formula injection
 * prefixes (=, +, -, @) in text cells while preserving genuine negative
 * numerics as numbers, and must handle large datasets without truncation.
 */
class FsaExcelInjectionGateTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private Category $category;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::create(['username' => 'FSA_excel_admin', 'full_name' => 'FSA Excel Admin', 'password' => 'test-password', 'email' => 'excel-admin@example.invalid', 'role' => 'admin', 'is_active' => true]);
        Sanctum::actingAs($this->admin);
        $this->category = Category::create(['name' => 'FSA EXCEL CATEGORY']);
    }

    private function permanent(string $name, array $overrides = []): Beneficiary
    {
        static $sequence = 0;
        $sequence++;

        return Beneficiary::create(array_merge([
            'beneficiary_type' => 'citizen', 'full_name' => $name,
            'national_id' => '20'.str_pad((string) $sequence, 8, '0', STR_PAD_LEFT),
            'phone' => '055'.str_pad((string) $sequence, 7, '0', STR_PAD_LEFT),
            'category_id' => $this->category->id,
            'status' => 'active',
            'city' => 'Riyadh', 'district' => 'North',
            'family_members_count' => 2, 'working_members_count' => 1,
            'non_working_children_count' => 1, 'income_sources' => [],
        ], $overrides));
    }

    private function saveExcel(string $content, string $name): string
    {
        $path = storage_path('framework/testing/fsa-'.$name.'.xlsx');
        file_put_contents($path, $content);

        return $path;
    }

    public function test_unified_export_neutralizes_all_formula_prefixes_and_preserves_text(): void
    {
        $this->permanent('=SUM(A1:A9)');
        $this->permanent('+1+1');
        $this->permanent('-1+1');
        $this->permanent('@SUM(1,1)');
        $this->permanent('SAFE NAME');

        $response = $this->get('/api/beneficiaries/unified/export?tab=permanent')->assertOk();
        $path = $this->saveExcel($response->streamedContent(), 'unified-injection');
        $sheet = IOFactory::load($path)->getActiveSheet();

        $names = [];
        for ($row = 2; $row <= $sheet->getHighestDataRow(); $row++) {
            $names[$row] = $sheet->getCell('B'.$row)->getValue();
        }
        $this->assertContains('=SUM(A1:A9)', array_values($names), 'text starting with = must be preserved as text');
        $this->assertContains('+1+1', array_values($names), 'text starting with + must be preserved as text');
        $this->assertContains('-1+1', array_values($names), 'text starting with - must be preserved as text');
        $this->assertContains('@SUM(1,1)', array_values($names), 'text starting with @ must be preserved as text');
        $this->assertContains('SAFE NAME', array_values($names));

        // Every injection-prefixed name cell must be a string cell, never a formula.
        foreach ($names as $row => $name) {
            if (! in_array($name, ['=SUM(A1:A9)', '+1+1', '-1+1', '@SUM(1,1)'], true)) {
                continue;
            }
            $this->assertSame(DataType::TYPE_STRING, $sheet->getCell('B'.$row)->getDataType(), "cell B{$row} must be a string, not a formula");
        }
        @unlink($path);
    }

    public function test_comprehensive_export_neutralizes_string_prefixes_and_keeps_negative_numerics(): void
    {
        // Injection-prefixed string fields.
        $this->permanent('=HYPERLINK("https://a.invalid","x")');
        $this->permanent('SAFE TEXT');
        // Negative numeric fields must survive as real numbers.
        $person = $this->permanent('NEGATIVE NUMERICS');
        DB::table('beneficiaries')->where('id', $person->id)->update([
            'monthly_salary' => -50.25, 'total_income' => -120.00, 'monthly_rent' => 30,
        ]);

        $response = $this->get('/api/reports/comprehensive/excel?start_date=2026-01-01&end_date=2026-12-31')->assertOk();
        $path = $this->saveExcel($response->streamedContent(), 'comprehensive-injection');
        $book = IOFactory::load($path);
        $sheet = $book->getSheetByName('beneficiaries_snapshot');
        $this->assertNotNull($sheet, 'beneficiaries_snapshot sheet must exist');

        // Column letters from permanentColumns order: full_name=B, monthly_salary=K, total_income=L, monthly_rent=M.
        $this->assertSame('K', Coordinate::stringFromColumnIndex(11));
        $this->assertSame('L', Coordinate::stringFromColumnIndex(12));

        $foundNegative = false;
        $foundNeutralized = false;
        for ($row = 2; $row <= $sheet->getHighestDataRow(); $row++) {
            $fullName = $sheet->getCell('B'.$row)->getValue();
            if (is_string($fullName) && str_starts_with($fullName, "'=HYPERLINK")) {
                $foundNeutralized = true;
                $this->assertSame(DataType::TYPE_STRING, $sheet->getCell('B'.$row)->getDataType());
            }
            foreach (['monthly_salary' => 'K', 'total_income' => 'L', 'monthly_rent' => 'M'] as $header => $column) {
                $value = $sheet->getCell($column.$row)->getValue();
                if (is_float($value) || is_int($value)) {
                    if ($value < 0) {
                        $foundNegative = true;
                        $this->assertSame(DataType::TYPE_NUMERIC, $sheet->getCell($column.$row)->getDataType(), "{$header} negative value must be numeric");
                    }
                }
            }
        }
        $this->assertTrue($foundNeutralized, 'string starting with = must be neutralized in the comprehensive export');
        $this->assertTrue($foundNegative, 'at least one negative numeric must be preserved in the export');
        @unlink($path);
    }

    public function test_large_unified_export_contains_every_row_without_truncation(): void
    {
        for ($i = 1; $i <= 350; $i++) {
            $this->permanent('LARGE ROW '.$i);
        }
        $response = $this->get('/api/beneficiaries/unified/export?tab=permanent')->assertOk();
        $path = $this->saveExcel($response->streamedContent(), 'large-export');
        $sheet = IOFactory::load($path)->getActiveSheet();

        // 350 data rows + header.
        $this->assertSame(351, $sheet->getHighestDataRow());
        $names = [];
        for ($row = 2; $row <= $sheet->getHighestDataRow(); $row++) {
            $names[] = (string) $sheet->getCell('B'.$row)->getValue();
        }
        $this->assertCount(350, $names);
        foreach (['LARGE ROW 1', 'LARGE ROW 123', 'LARGE ROW 175', 'LARGE ROW 350'] as $expected) {
            $this->assertContains($expected, $names, $expected.' must be present in the large export');
        }
        @unlink($path);
    }
}
