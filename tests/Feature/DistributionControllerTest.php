<?php

namespace Tests\Feature;

use App\Models\Basket;
use App\Models\Beneficiary;
use App\Models\Category;
use App\Models\Distribution;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class DistributionControllerTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;
    protected Category $category;
    protected Basket $basket;
    protected Beneficiary $beneficiary;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::create([
            'username' => 'distributor_user',
            'full_name' => 'مسؤول التوزيع',
            'password' => bcrypt('password123'),
            'role' => 'admin',
            'is_active' => true,
        ]);

        $this->category = Category::create([
            'name' => 'درجة أولى',
        ]);

        $this->basket = Basket::create([
            'name' => 'سلة غذائية كبرى',
            'stock_quantity' => 10,
        ]);

        $this->beneficiary = Beneficiary::create([
            'beneficiary_type' => 'citizen',
            'full_name' => 'ناصر حسن',
            'national_id' => '1000000005',
            'phone' => '0500000005',
            'category_id' => $this->category->id,
        ]);
    }

    public function test_authenticated_user_can_list_distributions(): void
    {
        Sanctum::actingAs($this->user);

        Distribution::create([
            'beneficiary_id' => $this->beneficiary->id,
            'basket_id' => $this->basket->id,
            'assigned_by' => $this->user->id,
            'barcode_code' => 'BC-1001',
            'status' => 'scheduled',
            'scheduled_at' => now(),
            'code' => 'DIST-1001',
        ]);

        $response = $this->getJson('/api/distributions');

        $response->assertStatus(200)
            ->assertJsonStructure(['data' => ['data']]);
    }

    public function test_authenticated_user_can_create_distribution_batch(): void
    {
        Sanctum::actingAs($this->user);

        $payload = [
            'beneficiary_ids' => [$this->beneficiary->id],
            'basket_id' => $this->basket->id,
            'scheduled_at' => now()->addDay()->toDateTimeString(),
        ];

        $response = $this->postJson('/api/distributions', $payload);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'message' => 'تم إنشاء وتخصيص 1 سلة دعم بنجاح.',
            ]);

        $this->assertDatabaseHas('distributions', [
            'beneficiary_id' => $this->beneficiary->id,
            'basket_id' => $this->basket->id,
        ]);
    }

    public function test_can_mark_distribution_as_received(): void
    {
        Sanctum::actingAs($this->user);

        $distribution = Distribution::create([
            'beneficiary_id' => $this->beneficiary->id,
            'basket_id' => $this->basket->id,
            'assigned_by' => $this->user->id,
            'barcode_code' => 'BC-1002',
            'status' => 'scheduled',
            'scheduled_at' => now(),
            'code' => 'DIST-1002',
        ]);

        $response = $this->putJson("/api/distributions/{$distribution->id}/received");

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'تم تأكيد الاستلام.',
            ]);

        $this->assertEquals('delivered', $distribution->refresh()->status);
    }
}
