<?php

namespace Tests\Feature;

use App\Models\InventoryItem;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class InventoryControllerTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::create([
            'username' => 'warehouse_manager',
            'full_name' => 'أمين المستودع',
            'password' => bcrypt('password123'),
            'role' => 'admin',
            'is_active' => true,
        ]);
    }

    public function test_authenticated_user_can_list_inventory_items(): void
    {
        Sanctum::actingAs($this->user);

        InventoryItem::create([
            'name' => 'كرتون طماطم',
            'unit' => 'كرتون',
            'current_quantity' => 100,
            'min_threshold' => 10,
        ]);

        $response = $this->getJson('/api/inventory');

        $response->assertStatus(200)
            ->assertJsonStructure(['data']);
    }

    public function test_authenticated_user_can_store_inventory_item(): void
    {
        Sanctum::actingAs($this->user);

        $payload = [
            'name' => 'أرز بسمتي 10 كجم',
            'unit' => 'كيس',
            'current_quantity' => 50,
            'min_threshold' => 5,
            'description' => 'شحنة تبرعات جديدة',
        ];

        $response = $this->postJson('/api/inventory', $payload);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'message' => 'تم إضافة الصنف بنجاح',
            ]);

        $this->assertDatabaseHas('inventory_items', [
            'name' => 'أرز بسمتي 10 كجم',
            'current_quantity' => 50,
        ]);

        $this->assertDatabaseHas('inventory_movements', [
            'quantity' => 50,
            'type' => 'in',
            'reason' => 'رصيد افتتاحي',
        ]);
    }

    public function test_authenticated_user_can_adjust_stock(): void
    {
        Sanctum::actingAs($this->user);

        $item = InventoryItem::create([
            'name' => 'زيت طعام 1.5 لتر',
            'unit' => 'عبوة',
            'current_quantity' => 40,
            'min_threshold' => 5,
        ]);

        $payload = [
            'type' => 'in',
            'quantity' => 20,
            'reason' => 'توريد إضافي',
        ];

        $response = $this->postJson("/api/inventory/{$item->id}/adjust", $payload);

        $response->assertStatus(200)
            ->assertJson(['success' => true]);

        $this->assertEquals(60, $item->refresh()->current_quantity);
    }
}
