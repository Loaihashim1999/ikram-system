<?php

namespace Tests\Feature;

use App\Models\NeighborhoodRep;
use App\Models\Staff;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Tests\TestCase;

class SmartExcelImportTest extends TestCase
{
    use RefreshDatabase;

    private function user(): User
    {
        return User::create(['username' => 'IMPORT_ADMIN', 'full_name' => 'Import Admin', 'phone' => '0500000001', 'password' => Hash::make('secret123'), 'role' => 'admin', 'is_active' => true]);
    }

    private function csv(string $content, string $name): UploadedFile
    {
        return UploadedFile::fake()->createWithContent($name, "\xEF\xBB\xBF".$content);
    }

    public function test_flexible_column_mapping_imports_all_three_entities_and_persists_after_new_login(): void
    {
        $user = $this->user();
        Sanctum::actingAs($user);

        $beneficiary = $this->csv("الجوال,اسم المستفيد,الحي,رقم الهوية\n0501111111,TEST SMART BENEFICIARY,العزيزية,1999999999\n", 'beneficiaries.csv');
        $preview = $this->post('/api/smart-import/beneficiaries/preview', ['file' => $beneficiary]);
        $preview->assertOk()->assertJsonPath('sheets.0.suggested_mapping.اسم المستفيد', 'full_name');
        $mapping = ['الجوال' => 'phone', 'اسم المستفيد' => 'full_name', 'الحي' => 'district', 'رقم الهوية' => 'national_id'];
        $this->post('/api/smart-import/beneficiaries', ['file' => $this->csv("الجوال,اسم المستفيد,الحي,رقم الهوية\n0501111111,TEST SMART BENEFICIARY,العزيزية,1999999999\n", 'beneficiaries.csv'), 'mapping' => json_encode($mapping)])->assertOk()->assertJsonPath('created', 1);

        $staffMapping = ['تاريخ التعيين' => 'hire_date', 'الوظيفة' => 'job_title', 'الهاتف' => 'phone', 'الهوية' => 'national_id', 'الاسم' => 'name'];
        $this->post('/api/smart-import/staff', ['file' => $this->csv("تاريخ التعيين,الوظيفة,الهاتف,الهوية,الاسم\n2026-01-10,باحث,0502222222,2888888888,TEST SMART STAFF\n", 'staff.csv'), 'mapping' => json_encode($staffMapping)])->assertOk()->assertJsonPath('created', 1);

        $orgMapping = ['حي الجهة' => 'district_name', 'هاتف التواصل' => 'phone', 'رقم الترخيص' => 'license_number', 'اسم المنظمة' => 'full_name'];
        $this->post('/api/smart-import/organizations', ['file' => $this->csv("حي الجهة,هاتف التواصل,رقم الترخيص,اسم المنظمة\nالصفا,0503333333,LIC-333,TEST SMART ORG\n", 'organizations.csv'), 'mapping' => json_encode($orgMapping)])->assertOk()->assertJsonPath('created', 1);

        $this->assertDatabaseHas('beneficiaries', ['national_id' => '1999999999', 'full_name' => 'TEST SMART BENEFICIARY', 'district' => 'العزيزية']);
        $this->assertDatabaseHas('staff', ['national_id' => '2888888888', 'name' => 'TEST SMART STAFF', 'job_title' => 'باحث']);
        $this->assertDatabaseHas('neighborhood_reps', ['license_number' => 'LIC-333', 'organization_name' => 'TEST SMART ORG', 'district_name' => 'الصفا']);

        $this->getJson('/api/beneficiaries?search=1999999999')->assertOk()->assertJsonPath('data.data.0.phone', '0501111111');
        $this->getJson('/api/staff?search=TEST SMART STAFF')->assertOk()->assertJsonPath('data.data.0.job_title', 'باحث');
        $this->getJson('/api/neighborhood-reps?search=LIC-333')->assertOk()->assertJsonPath('data.0.phone', '0503333333');

        $this->postJson('/api/logout')->assertOk();
        $login = $this->postJson('/api/login', ['username' => 'IMPORT_ADMIN', 'password' => 'secret123'])->assertOk();
        $token = $login->json('data.token');
        $this->withToken($token)->getJson('/api/beneficiaries?search=1999999999')->assertOk()->assertJsonPath('data.data.0.full_name', 'TEST SMART BENEFICIARY');
        $staff = Staff::where('national_id', '2888888888')->firstOrFail();
        $this->withToken($token)->getJson('/api/staff/'.$staff->id)->assertOk()->assertJsonPath('data.name', 'TEST SMART STAFF');
        $organization = NeighborhoodRep::where('license_number', 'LIC-333')->firstOrFail();
        $this->withToken($token)->getJson('/api/neighborhood-reps/'.$organization->id)->assertOk()->assertJsonPath('data.representative.full_name', 'TEST SMART ORG');
    }

    public function test_real_xlsx_file_with_reordered_and_extra_columns_is_previewed_and_imported(): void
    {
        Sanctum::actingAs($this->user());
        $spreadsheet = new Spreadsheet;
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->fromArray([
            ['ملاحظة إضافية', 'رقم الهوية', 'الحي', 'اسم المستفيد', 'الجوال'],
            ['يجب تجاهلها', '1777777777', 'النسيم', 'TEST XLSX BENEFICIARY', '0507777777'],
        ]);
        $path = tempnam(sys_get_temp_dir(), 'ikram-xlsx-').'.xlsx';
        (new Xlsx($spreadsheet))->save($path);

        try {
            $upload = fn () => new UploadedFile($path, 'beneficiaries.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', null, true);
            $this->post('/api/smart-import/beneficiaries/preview', ['file' => $upload()])
                ->assertOk()
                ->assertJsonPath('sheets.0.suggested_mapping.اسم المستفيد', 'full_name');
            $mapping = ['رقم الهوية' => 'national_id', 'الحي' => 'district', 'اسم المستفيد' => 'full_name', 'الجوال' => 'phone'];
            $this->post('/api/smart-import/beneficiaries', ['file' => $upload(), 'mapping' => json_encode($mapping)])
                ->assertOk()
                ->assertJsonPath('created', 1);
            $this->assertDatabaseHas('beneficiaries', ['national_id' => '1777777777', 'full_name' => 'TEST XLSX BENEFICIARY']);
        } finally {
            @unlink($path);
        }
    }

    public function test_multi_sheet_aliases_duplicates_and_row_level_errors(): void
    {
        Sanctum::actingAs($this->user());
        $spreadsheet = new Spreadsheet;
        $spreadsheet->getActiveSheet()->setTitle('تعليمات')->fromArray([['تعليمات فقط']]);
        $data = $spreadsheet->createSheet()->setTitle('بيانات');
        $data->fromArray([
            ['mobile', 'السجل المدني', 'اسم المستفيد', 'اسم الحي', 'الراتب'],
            ['0508888888', '1888888888', 'TEST MULTISHEET VALID', 'العوالي', '2200'],
            ['0509999999', '', 'TEST MULTISHEET INVALID', 'العوالي', 'bad'],
            ['0508888888', '1888888888', 'TEST MULTISHEET DUPLICATE', 'العوالي', '2200'],
        ]);
        $path = tempnam(sys_get_temp_dir(), 'ikram-multi-').'.xlsx';
        (new Xlsx($spreadsheet))->save($path);
        try {
            $upload = fn () => new UploadedFile($path, 'multi.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', null, true);
            $preview = $this->post('/api/smart-import/beneficiaries/preview', ['file' => $upload()])->assertOk();
            $preview->assertJsonPath('sheets.0.name', 'بيانات')
                ->assertJsonPath('sheets.0.suggested_mapping.mobile', 'phone')
                ->assertJsonPath('sheets.0.suggested_mapping.السجل المدني', 'national_id');
            $mapping = ['mobile' => 'phone', 'السجل المدني' => 'national_id', 'اسم المستفيد' => 'full_name', 'اسم الحي' => 'district', 'الراتب' => 'monthly_salary'];
            $result = $this->post('/api/smart-import/beneficiaries', ['file' => $upload(), 'sheet' => 'بيانات', 'mapping' => json_encode($mapping)])->assertOk();
            $result->assertJsonPath('created', 1)->assertJsonPath('skipped', 1)->assertJsonPath('failed', 1)
                ->assertJsonPath('errors.0', fn ($value) => str_contains($value, 'الصف 3'));
            $this->assertDatabaseHas('beneficiaries', ['national_id' => '1888888888', 'full_name' => 'TEST MULTISHEET VALID']);
            $this->assertDatabaseMissing('beneficiaries', ['full_name' => 'TEST MULTISHEET INVALID']);
        } finally {
            @unlink($path);
        }
    }
}
