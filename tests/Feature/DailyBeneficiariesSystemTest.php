<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\DailyBeneficiary;
use App\Models\DailyInventoryItem;
use App\Models\DailyReceivingTransaction;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class DailyBeneficiariesSystemTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;
    protected Category $category;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::create([
            'username' => 'daily_admin',
            'full_name' => 'مشرف اليوميين',
            'password' => bcrypt('password123'),
            'role' => 'admin',
            'is_active' => true,
        ]);

        $this->category = Category::create([
            'name' => 'أسر متعففة',
        ]);
    }

    public function test_can_create_daily_beneficiary(): void
    {
        Sanctum::actingAs($this->admin);

        $response = $this->postJson('/api/daily-beneficiaries', [
            'full_name' => 'عبدالله خالد السعد',
            'national_id' => '1099887766',
            'phone' => '0551122334',
            'district' => 'حي الصفا',
            'date_of_birth' => '1985-05-10',
            'category_id' => $this->category->id,
            'status' => 'active',
            'notes' => 'مستفيد يومي تجريبي',
        ]);

        $response->assertStatus(201);
        $response->assertJsonPath('success', true);
        $response->assertJsonPath('data.full_name', 'عبدالله خالد السعد');

        $this->assertDatabaseHas('daily_beneficiaries', [
            'national_id' => '1099887766',
            'district' => 'حي الصفا',
        ]);
    }

    public function test_prevents_duplicate_national_id_for_daily_beneficiaries(): void
    {
        Sanctum::actingAs($this->admin);

        DailyBeneficiary::create([
            'full_name' => 'الأول',
            'national_id' => '1099887766',
            'phone' => '0551122334',
            'district' => 'حي الصفا',
        ]);

        $response = $this->postJson('/api/daily-beneficiaries', [
            'full_name' => 'الثاني مكرر',
            'national_id' => '1099887766',
            'phone' => '0562233445',
            'district' => 'حي الروضة',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['national_id']);
    }

    public function test_daily_inventory_management_and_stock_adjustment(): void
    {
        Sanctum::actingAs($this->admin);

        // 1. Create item
        $createRes = $this->postJson('/api/daily-inventory', [
            'name' => 'سلة وجبات إفطار يومية',
            'quantity' => 20,
            'unit' => 'وجبة',
            'min_threshold' => 5,
        ]);

        $createRes->assertStatus(201);
        $itemId = $createRes->json('data.id');

        // 2. Adjust stock out
        $adjRes = $this->postJson("/api/daily-inventory/{$itemId}/adjust", [
            'type' => 'out',
            'quantity' => 5,
            'reason' => 'صرف يدوي للتالف',
        ]);

        $adjRes->assertStatus(200);
        $this->assertEquals(15, $adjRes->json('data.item.current_quantity'));

        // 3. Movement logged
        $this->assertDatabaseHas('daily_inventory_movements', [
            'daily_inventory_item_id' => $itemId,
            'type' => 'out',
            'quantity' => 5,
        ]);
    }

    public function test_daily_receiving_transaction_execution_and_stock_deduction(): void
    {
        Sanctum::actingAs($this->admin);

        $beneficiary = DailyBeneficiary::create([
            'full_name' => 'سالم محمد العلي',
            'national_id' => '1011223344',
            'phone' => '0501122334',
            'district' => 'حي الجامعة',
            'status' => 'active',
        ]);

        $item = DailyInventoryItem::create([
            'name' => 'سلة تمور وفاكهة',
            'current_quantity' => 10,
            'unit' => 'سلة',
            'min_threshold' => 2,
        ]);

        // Execute receiving transaction
        $response = $this->postJson('/api/daily-receiving', [
            'daily_beneficiary_id' => $beneficiary->id,
            'daily_inventory_item_id' => $item->id,
            'quantity' => 2,
            'notes' => 'تسليم بحضور المستفيد',
        ]);

        $response->assertStatus(201);
        $response->assertJsonPath('success', true);

        // Check inventory decremented to 8
        $this->assertEquals(8, $item->fresh()->current_quantity);

        // Check beneficiary total_received_count incremented to 1
        $this->assertEquals(1, $beneficiary->fresh()->total_received_count);
        $this->assertNotNull($beneficiary->fresh()->last_delivery_date);

        // Check movement created
        $this->assertDatabaseHas('daily_inventory_movements', [
            'daily_inventory_item_id' => $item->id,
            'type' => 'out',
            'quantity' => 2,
        ]);

        // Check transaction recorded with document number
        $this->assertDatabaseHas('daily_receiving_transactions', [
            'daily_beneficiary_id' => $beneficiary->id,
            'daily_inventory_item_id' => $item->id,
            'quantity' => 2,
        ]);
    }

    public function test_daily_receiving_fails_when_stock_is_insufficient(): void
    {
        Sanctum::actingAs($this->admin);

        $beneficiary = DailyBeneficiary::create([
            'full_name' => 'سالم العلي',
            'national_id' => '1011223344',
            'phone' => '0501122334',
            'district' => 'حي الجامعة',
        ]);

        $item = DailyInventoryItem::create([
            'name' => 'سلة نادرة',
            'current_quantity' => 1,
            'unit' => 'سلة',
        ]);

        // Attempt to request 5 units when only 1 is available
        $response = $this->postJson('/api/daily-receiving', [
            'daily_beneficiary_id' => $beneficiary->id,
            'daily_inventory_item_id' => $item->id,
            'quantity' => 5,
        ]);

        $response->assertStatus(422);
        $response->assertJsonPath('success', false);
        $this->assertEquals(1, $item->fresh()->current_quantity);
    }

    public function test_analytics_endpoint_returns_comprehensive_metrics(): void
    {
        Sanctum::actingAs($this->admin);

        $response = $this->getJson('/api/analytics?period_type=weekly');

        $response->assertStatus(200);
        $response->assertJsonStructure([
            'success',
            'period' => ['type', 'start_date', 'end_date', 'label'],
            'kpis' => ['grand_total_beneficiaries', 'grand_total_served', 'grand_total_baskets'],
            'beneficiaries',
            'daily_beneficiaries',
            'staff',
            'organizations',
            'neighborhoods',
            'inventory' => ['main', 'daily', 'expiry_alerts'],
            'delivery',
        ]);
    }
}
