<?php

namespace Tests\Feature;

use App\Models\Beneficiary;
use App\Models\Category;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
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
            'password' => bcrypt('password123'),
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
            'category_id' => $this->category->id,
            'monthly_salary' => 2500,
            'city' => 'الرياض',
            'district' => 'الملز',
        ];

        $response = $this->postJson('/api/beneficiaries', $payload);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'message' => 'تمت إضافة المستفيد بنجاح.',
            ]);

        $this->assertDatabaseHas('beneficiaries', [
            'national_id' => '1000000002',
            'full_name' => 'عبدالله خالد',
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
}
