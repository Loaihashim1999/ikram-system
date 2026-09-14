<?php

namespace Tests\Feature;

use App\Models\Beneficiary;
use App\Models\Category;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class BeneficiaryControllerTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;

    protected Category $category;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::create([
            'username' => 'staff_user',
            'full_name' => 'موظف الجمعية',
            'password' => Hash::make('password123'),
            'role' => 'admin',
            'is_active' => true,
        ]);

        $this->category = Category::create([
            'name' => 'درجة أولى',
            'description' => 'الفئة الأكثر احتياجاً',
        ]);
    }

    public function test_authenticated_user_can_list_beneficiaries(): void
    {
        Sanctum::actingAs($this->user);

        Beneficiary::create([
            'beneficiary_type' => 'citizen',
            'full_name' => 'محمد أحمد',
            'national_id' => '1000000001',
            'phone' => '0500000001',
            'category_id' => $this->category->id,
        ]);

        $response = $this->getJson('/api/beneficiaries');

        $response->assertStatus(200)
            ->assertJsonStructure(['data' => ['data']]);
    }

    public function test_authenticated_user_can_create_beneficiary(): void
    {
        Sanctum::actingAs($this->user);

        $payload = [
            'beneficiary_type' => 'citizen',
            'full_name' => 'عبدالله خالد',
            'national_id' => '1000000002',
            'phone' => '0500000002',
            'date_of_birth' => '1990-01-01',
            'category_id' => $this->category->id,
            'monthly_salary' => 2500,
            'city' => 'الرياض',
            'district' => 'الملز',
            'street' => 'شارع الستين',
            'family_status' => 'poor',
            'family_members_count' => 4,
            'housing_type' => 'own',
        ];

        $response = $this->postJson('/api/beneficiaries', $payload);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'message' => 'تمت إضافة وحفظ المستفيد والبيانات الأسرية بنجاح.',
            ]);

        $this->assertDatabaseHas('beneficiaries', [
            'national_id' => '1000000002',
            'full_name' => 'عبدالله خالد',
        ]);
    }

    public function test_validation_fails_when_mandatory_fields_are_missing(): void
    {
        Sanctum::actingAs($this->user);

        // Missing full_name, phone, street, family_status, family_members_count, housing_type
        $response = $this->postJson('/api/beneficiaries', [
            'beneficiary_type' => 'citizen',
            'national_id' => '1000000099',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors([
                'full_name',
                'phone',
                'street',
                'family_status',
                'family_members_count',
                'housing_type',
            ]);
    }

    public function test_check_national_id_returns_availability(): void
    {
        Sanctum::actingAs($this->user);

        Beneficiary::create([
            'beneficiary_type' => 'citizen',
            'full_name' => 'سعيد عمر',
            'national_id' => '1000000003',
            'phone' => '0500000003',
            'category_id' => $this->category->id,
        ]);

        $responseExisting = $this->getJson('/api/beneficiaries/check-national-id/1000000003');
        $responseExisting->assertStatus(200)
            ->assertJson(['exists' => true]);

        $responseNew = $this->getJson('/api/beneficiaries/check-national-id/1000000099');
        $responseNew->assertStatus(200)
            ->assertJson(['exists' => false]);
    }

    public function test_can_add_dependent_to_beneficiary(): void
    {
        Sanctum::actingAs($this->user);

        $beneficiary = Beneficiary::create([
            'beneficiary_type' => 'citizen',
            'full_name' => 'فاطمة علي',
            'national_id' => '1000000004',
            'phone' => '0500000004',
            'category_id' => $this->category->id,
        ]);

        $response = $this->postJson("/api/beneficiaries/{$beneficiary->id}/dependents", [
            'name' => 'ياسر محمد',
            'relationship' => 'ابن',
            'national_id' => '1100000004',
        ]);

        $response->assertStatus(201)
            ->assertJson(['success' => true]);

        $this->assertDatabaseHas('dependents', [
            'beneficiary_id' => $beneficiary->id,
            'name' => 'ياسر محمد',
        ]);
    }
    public function test_backend_recalculates_selected_sources_and_rejects_resident_first_degree(): void
    {
        Sanctum::actingAs($this->user);
        Category::firstOrCreate(['name' => 'درجة ثانية'], ['description' => 'الفئة الثانية']);

        $response = $this->postJson('/api/beneficiaries', [
            'beneficiary_type' => 'resident', 'full_name' => 'TEST RESIDENT',
            'national_id' => '2999999991', 'phone' => '0509999991',
            'date_of_birth' => '1990-01-01', 'nationality' => 'TEST',
            'city' => 'مكة', 'district' => 'TEST', 'street' => 'TEST',
            'family_status' => 'poor', 'family_members_count' => 2,
            'housing_type' => 'rent', 'annual_rent_amount' => 12000,
            'income_sources' => ['salary', 'family_support'],
            'monthly_salary' => 3000, 'family_support' => 500,
            'social_security_amount' => 9000, 'priority' => 'first_class',
        ])->assertCreated();

        $response->assertJsonPath('data.priority', 'second_class')
            ->assertJsonPath('data.total_income', '3500.00')
            ->assertJsonPath('data.monthly_rent', '1000.00')
            ->assertJsonPath('data.net_income', '2500.00')
            ->assertJsonPath('data.social_security_amount', '0.00');
    }

    public function test_deselected_stale_income_is_cleared_on_update(): void
    {
        Sanctum::actingAs($this->user);
        Category::firstOrCreate(['name' => 'درجة ثانية'], ['description' => 'الفئة الثانية']);
        $beneficiary = Beneficiary::create([
            'beneficiary_type' => 'citizen', 'full_name' => 'TEST CITIZEN',
            'national_id' => '1999999991', 'phone' => '0509999992', 'date_of_birth' => '1990-01-01',
            'city' => 'مكة', 'district' => 'TEST', 'street' => 'TEST', 'family_status' => 'poor',
            'family_members_count' => 2, 'housing_type' => 'own',
            'income_sources' => ['salary', 'citizen_account'], 'monthly_salary' => 2000,
            'citizen_account_amount' => 1000,
        ]);

        $this->putJson('/api/beneficiaries/'.$beneficiary->id, [
            'beneficiary_type' => 'citizen', 'full_name' => 'TEST CITIZEN',
            'national_id' => '1999999991', 'phone' => '0509999992', 'date_of_birth' => '1990-01-01',
            'city' => 'مكة', 'district' => 'TEST', 'street' => 'TEST', 'family_status' => 'poor',
            'family_members_count' => 2, 'housing_type' => 'own',
            'income_sources' => ['salary'], 'monthly_salary' => 2000,
            'citizen_account_amount' => 1000,
        ])->assertOk()->assertJsonPath('data.total_income', '2000.00');

        $this->assertDatabaseHas('beneficiaries', ['id' => $beneficiary->id, 'citizen_account_amount' => 0]);
    }

}
