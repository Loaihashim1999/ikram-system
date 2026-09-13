<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\DailyBeneficiary;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class FullFunctionalQaTest extends TestCase
{
    use RefreshDatabase;

    private function admin(string $username = 'TEST_QA_ADMIN'): User
    {
        return User::create(['username' => $username, 'full_name' => 'TEST QA ADMIN', 'password' => 'Password123!', 'role' => 'admin', 'is_active' => true]);
    }

    public function test_daily_beneficiary_crud_filters_pagination_upload_and_soft_delete(): void
    {
        Storage::fake('public');
        Sanctum::actingAs($this->admin());
        $category = Category::create(['name' => 'TEST_DAILY_CATEGORY']);

        for ($i = 1; $i <= 18; $i++) {
            DailyBeneficiary::create([
                'full_name' => sprintf('TEST_DAILY_%03d', $i),
                'national_id' => '1'.str_pad((string) $i, 9, '0', STR_PAD_LEFT),
                'phone' => '05'.str_pad((string) $i, 8, '0', STR_PAD_LEFT),
                'district' => $i % 2 ? 'TEST_NORTH' : 'TEST_SOUTH',
                'category_id' => $category->id,
                'status' => $i === 18 ? 'inactive' : 'active',
            ]);
        }

        $this->getJson('/api/daily-beneficiaries?per_page=5&page=2')->assertOk()
            ->assertJsonPath('data.per_page', 5)->assertJsonCount(5, 'data.data');
        $this->getJson('/api/daily-beneficiaries?search=TEST_DAILY_003')->assertOk()
            ->assertJsonPath('data.total', 1)->assertJsonPath('data.data.0.district', 'TEST_NORTH');
        $this->getJson('/api/daily-beneficiaries?district=TEST_SOUTH&status=inactive')->assertOk()
            ->assertJsonPath('data.total', 1);

        $record = DailyBeneficiary::where('national_id', '1000000001')->firstOrFail();
        $this->putJson('/api/daily-beneficiaries/'.$record->id, [
            'full_name' => 'TEST_DAILY_UPDATED', 'national_id' => $record->national_id,
            'phone' => '0551234567', 'district' => 'TEST_UPDATED_DISTRICT',
            'category_id' => $category->id, 'status' => 'active', 'notes' => 'TEST_ARABIC_اختبار',
        ])->assertOk()->assertJsonPath('data.notes', 'TEST_ARABIC_اختبار');
        $this->getJson('/api/daily-beneficiaries/'.$record->id)->assertOk()
            ->assertJsonPath('data.district', 'TEST_UPDATED_DISTRICT');

        $upload = $this->post('/api/daily-beneficiaries/'.$record->id.'/documents', [
            'document' => UploadedFile::fake()->image('TEST_ID.png', 100, 100),
            'document_type' => 'identity', 'title' => 'TEST_IDENTITY',
        ])->assertCreated();
        Storage::disk('public')->assertExists($upload->json('data.file_path'));
        $firstPath = $upload->json('data.file_path');
        $duplicateName = $this->post('/api/daily-beneficiaries/'.$record->id.'/documents', [
            'document' => UploadedFile::fake()->image('TEST_ID.png', 100, 100),
            'document_type' => 'identity', 'title' => 'TEST_IDENTITY_DUPLICATE_NAME',
        ])->assertCreated();
        $this->assertNotSame($firstPath, $duplicateName->json('data.file_path'));
        Storage::disk('public')->assertExists($duplicateName->json('data.file_path'));
        $this->assertNotEmpty(Storage::disk('public')->get($firstPath));

        $pdf = $this->post('/api/daily-beneficiaries/'.$record->id.'/documents', [
            'document' => UploadedFile::fake()->createWithContent('TEST_DOCUMENT.pdf', '%PDF-1.4 TEST'),
            'document_type' => 'supporting',
        ])->assertCreated();
        Storage::disk('public')->assertExists($pdf->json('data.file_path'));
        $this->post('/api/daily-beneficiaries/'.$record->id.'/documents', [
            'document' => UploadedFile::fake()->create('TEST_BAD.exe', 10, 'application/octet-stream'),
            'document_type' => 'identity',
        ])->assertUnprocessable();
        $this->post('/api/daily-beneficiaries/'.$record->id.'/documents', [
            'document' => UploadedFile::fake()->create('TEST_TOO_LARGE.pdf', 10241, 'application/pdf'),
            'document_type' => 'identity',
        ])->assertUnprocessable();

        $this->putJson('/api/daily-beneficiaries/'.$record->id, [
            'full_name' => 'TEST_DAILY_UPDATED_AGAIN', 'national_id' => $record->national_id,
            'phone' => '0551234567', 'district' => 'TEST_UPDATED_DISTRICT',
            'category_id' => $category->id, 'status' => 'active', 'notes' => 'TEST_DOCUMENT_PRESERVED',
        ])->assertOk();
        Storage::disk('public')->assertExists($firstPath);

        $restricted = User::create(['username' => 'TEST_UPLOAD_READONLY', 'full_name' => 'TEST UPLOAD READONLY', 'password' => 'Password123!', 'role' => 'readonly', 'is_active' => true]);
        Sanctum::actingAs($restricted);
        $this->post('/api/daily-beneficiaries/'.$record->id.'/documents', [
            'document' => UploadedFile::fake()->image('TEST_FORBIDDEN.png'),
            'document_type' => 'identity',
        ])->assertForbidden();
        Sanctum::actingAs(User::where('username', 'TEST_QA_ADMIN')->firstOrFail());

        $this->deleteJson('/api/daily-beneficiaries/'.$record->id)->assertOk();
        $this->assertSoftDeleted('daily_beneficiaries', ['id' => $record->id]);
        $this->assertDatabaseHas('daily_beneficiary_documents', ['daily_beneficiary_id' => $record->id, 'file_name' => 'TEST_IDENTITY']);
    }

    public function test_organization_profile_fields_survive_create_edit_search_and_reopen(): void
    {
        Sanctum::actingAs($this->admin());
        $created = $this->postJson('/api/neighborhood-reps', [
            'full_name' => 'TEST_ORGANIZATION_ALPHA', 'organization_name' => 'TEST_ORGANIZATION_ALPHA',
            'organization_type' => 'جمعية خيرية', 'license_number' => 'TEST-LIC-100',
            'national_id' => 'TEST-LIC-100', 'contact_person' => 'TEST_CONTACT',
            'email' => 'test-org@example.test', 'phone' => '0501234567',
            'city' => 'مكة المكرمة', 'district_name' => 'TEST_DISTRICT',
            'national_address' => 'TEST_ADDRESS', 'beneficiaries_count' => 7,
        ])->assertCreated();
        $id = $created->json('data.id');
        $this->getJson('/api/neighborhood-reps?search=TEST-LIC-100')->assertOk()
            ->assertJsonPath('data.0.email', 'test-org@example.test');
        $this->postJson('/api/neighborhood-reps/'.$id, [
            'full_name' => 'TEST_ORGANIZATION_ALPHA', 'organization_name' => 'TEST_ORGANIZATION_ALPHA',
            'organization_type' => 'وقف', 'license_number' => 'TEST-LIC-100',
            'contact_person' => 'TEST_CONTACT_UPDATED', 'email' => 'updated@example.test',
            'phone' => '0501234567', 'city' => 'جدة', 'district_name' => 'TEST_DISTRICT',
            'national_address' => 'TEST_ADDRESS', 'beneficiaries_count' => 7, 'status' => 'active',
        ])->assertOk();
        $this->getJson('/api/neighborhood-reps/'.$id)->assertOk()
            ->assertJsonPath('data.representative.organization_type', 'وقف')
            ->assertJsonPath('data.representative.contact_person', 'TEST_CONTACT_UPDATED')
            ->assertJsonPath('data.representative.email', 'updated@example.test');
    }

    public function test_user_account_create_edit_password_activation_permissions_and_safe_delete(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);
        $created = $this->postJson('/api/users', [
            'username' => 'TEST_USER_001', 'password' => 'Initial123!', 'full_name' => 'TEST USER ONE',
            'phone' => '0509999999', 'role' => 'readonly',
            'permissions' => ['beneficiaries' => ['view' => true, 'create' => false]],
        ])->assertCreated();
        $id = $created->json('data.id');
        $this->putJson('/api/users/'.$id, [
            'full_name' => 'TEST USER UPDATED', 'password' => 'Changed123!', 'is_active' => false,
        ])->assertOk();
        $account = User::findOrFail($id);
        $this->assertSame('TEST USER UPDATED', $account->full_name);
        $this->assertFalse($account->is_active);
        $this->assertTrue(Hash::check('Changed123!', $account->password));
        $this->postJson('/api/login', ['username' => 'TEST_USER_001', 'password' => 'Changed123!'])->assertUnprocessable();
        $this->deleteJson('/api/users/'.$id)->assertOk();
        $this->assertDatabaseMissing('users', ['id' => $id]);

        $restricted = User::create(['username' => 'TEST_RESTRICTED', 'full_name' => 'TEST RESTRICTED', 'password' => 'Password123!', 'role' => 'assistant_admin', 'is_active' => true]);
        Sanctum::actingAs($restricted);
        $this->postJson('/api/users', [])->assertForbidden();
        $this->deleteJson('/api/users/'.$admin->id)->assertForbidden();
    }
}
