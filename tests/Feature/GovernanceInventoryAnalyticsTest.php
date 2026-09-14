<?php

namespace Tests\Feature;

use App\Models\DailyInventoryItem;
use App\Models\DailyInventoryMovement;
use App\Models\InventoryItem;
use App\Models\InventoryMovement;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class GovernanceInventoryAnalyticsTest extends TestCase
{
    use RefreshDatabase;

    public function test_inventory_drilldown_and_consumption_use_the_selected_period(): void
    {
        $admin = User::create(['username' => 'governance_admin', 'full_name' => 'Governance Admin', 'password' => 'irrelevant', 'role' => 'admin', 'is_active' => true]);
        Sanctum::actingAs($admin);

        $main = InventoryItem::create(['name' => 'أرز', 'unit' => 'كجم', 'current_quantity' => 4, 'min_threshold' => 5]);
        $daily = DailyInventoryItem::create(['name' => 'سلة يومية', 'unit' => 'سلة', 'current_quantity' => 3, 'min_threshold' => 5, 'expiry_date' => now()->addDays(5)]);
        InventoryMovement::create(['inventory_item_id' => $main->id, 'type' => 'out', 'quantity' => 8, 'user_id' => $admin->id]);
        DailyInventoryMovement::create(['daily_inventory_item_id' => $daily->id, 'type' => 'out', 'quantity' => 2, 'reason' => 'اختبار صرف', 'user_id' => $admin->id]);
        $old = InventoryMovement::create(['inventory_item_id' => $main->id, 'type' => 'out', 'quantity' => 100, 'user_id' => $admin->id]);
        $old->forceFill(['created_at' => now()->subMonth(), 'updated_at' => now()->subMonth()])->saveQuietly();

        $date = now()->toDateString();
        $this->getJson("/api/analytics?period_type=custom&start_date={$date}&end_date={$date}")
            ->assertOk()
            ->assertJsonPath('inventory.main.low_stock_items.0.name', 'أرز')
            ->assertJsonPath('inventory.daily.low_stock_items.0.name', 'سلة يومية')
            ->assertJsonPath('inventory.main.consumption.0.quantity', 8)
            ->assertJsonPath('inventory.main.consumption.0.share_of_period_outflow', 100)
            ->assertJsonPath('inventory.daily.consumption.0.quantity', 2)
            ->assertJsonPath('inventory.expiry_alerts.in_7_days_count', 1);
    }
}
