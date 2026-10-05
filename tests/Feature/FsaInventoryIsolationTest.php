<?php

namespace Tests\Feature;

use App\Models\DailyInventoryItem;
use App\Models\DailyInventoryMovement;
use App\Models\InventoryItem;
use App\Models\InventoryMovement;
use App\Models\Organization;
use App\Models\PickupLocation;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * FSA Section 9 gate: Daily Beneficiary Inventory stays independent from the
 * General Warehouse. Both mutation directions are exercised over real HTTP:
 * daily adjustments must never touch general InventoryItem rows, and general
 * warehouse adjustments must never touch DailyInventoryItem rows.
 */
class FsaInventoryIsolationTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::create([
            'username' => 'FSA_iso_admin', 'full_name' => 'FSA Isolation Admin',
            'password' => 'test-password', 'email' => 'iso-admin@example.invalid',
            'role' => 'admin', 'is_active' => true,
        ]);
        Sanctum::actingAs($this->admin);
    }

    public function test_daily_adjustment_never_mutates_general_warehouse(): void
    {
        $general = InventoryItem::create(['name' => 'GENERAL RICE', 'unit' => 'kg', 'current_quantity' => 100, 'min_threshold' => 5]);
        $daily = DailyInventoryItem::create(['name' => 'DAILY BASKET', 'unit' => 'basket', 'current_quantity' => 20, 'min_threshold' => 5]);

        $this->postJson('/api/daily-inventory/'.$daily->id.'/adjust', [
            'type' => 'in', 'quantity' => 7, 'reason' => 'FSA isolation test supply',
        ])->assertOk();

        $this->assertSame(27.0, (float) $daily->fresh()->current_quantity);
        $this->assertSame(100.0, (float) $general->fresh()->current_quantity);
        $this->assertSame(0, InventoryMovement::where('inventory_item_id', $general->id)->count());
        $this->assertSame(1, DailyInventoryMovement::where('daily_inventory_item_id', $daily->id)->count());
    }

    public function test_general_warehouse_adjustment_never_mutates_daily_inventory(): void
    {
        $general = InventoryItem::create(['name' => 'GENERAL RICE', 'unit' => 'kg', 'current_quantity' => 100, 'min_threshold' => 5]);
        $daily = DailyInventoryItem::create(['name' => 'DAILY BASKET', 'unit' => 'basket', 'current_quantity' => 20, 'min_threshold' => 5]);

        $this->postJson('/api/inventory/'.$general->id.'/adjust', [
            'type' => 'out', 'quantity' => 15, 'reason' => 'FSA isolation test issue',
        ])->assertOk();

        $this->assertSame(85.0, (float) $general->fresh()->current_quantity);
        $this->assertSame(20.0, (float) $daily->fresh()->current_quantity);
        $this->assertSame(0, DailyInventoryMovement::where('daily_inventory_item_id', $daily->id)->count());
        $this->assertSame(1, InventoryMovement::where('inventory_item_id', $general->id)->count());
    }

    public function test_support_reservation_uses_general_stock_and_leaves_daily_stock_untouched(): void
    {
        $general = InventoryItem::create(['name' => 'GENERAL FLOUR', 'unit' => 'bag', 'current_quantity' => 50, 'min_threshold' => 5]);
        $daily = DailyInventoryItem::create(['name' => 'DAILY BASKET', 'unit' => 'basket', 'current_quantity' => 20, 'min_threshold' => 5]);
        $location = PickupLocation::create(['name' => 'FSA ISOLATION PICKUP']);
        $org = Organization::create(['name' => 'FSA ISOLATION ORG', 'code' => 'FSA_ISO', 'status' => 'active']);

        $id = $this->postJson('/api/support/distributions', [
            'recipient_type' => 'organization', 'organization_id' => $org->id,
            'fulfillment_method' => 'pickup', 'pickup_location_id' => $location->id,
            'items' => [['inventory_item_id' => $general->id, 'requested_quantity' => '2.50']],
        ])->assertCreated()->json('data.id');

        $this->patchJson('/api/support/distributions/'.$id.'/approve')->assertOk();
        $this->patchJson('/api/support/distributions/'.$id.'/reserve')->assertOk();

        $this->assertSame('2.50', $general->fresh()->reserved_quantity);
        $this->assertSame(20.0, (float) $daily->fresh()->current_quantity);
        $this->assertSame(0.0, (float) $daily->fresh()->reserved_quantity);
        $this->assertSame(0, DailyInventoryMovement::where('daily_inventory_item_id', $daily->id)->count());
    }

    public function test_daily_delete_removes_only_daily_row_and_general_remains(): void
    {
        $general = InventoryItem::create(['name' => 'GENERAL RICE', 'unit' => 'kg', 'current_quantity' => 100, 'min_threshold' => 5]);
        $daily = DailyInventoryItem::create(['name' => 'DAILY BASKET', 'unit' => 'basket', 'current_quantity' => 9, 'min_threshold' => 5]);
        $dailyId = $daily->id;

        $this->deleteJson('/api/daily-inventory/'.$dailyId)->assertOk();

        // DailyInventoryItem uses SoftDeletes: the delete is a soft delete.
        $this->assertSoftDeleted('daily_inventory_items', ['id' => $dailyId]);
        $this->assertNotNull(DailyInventoryItem::withTrashed()->find($dailyId)?->deleted_at);
        $this->assertDatabaseHas('inventory_items', ['id' => $general->id, 'current_quantity' => '100.00']);
    }
}
