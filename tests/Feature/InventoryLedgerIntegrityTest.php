<?php

namespace Tests\Feature;

use App\Models\DailyInventoryItem;
use App\Models\InventoryItem;
use App\Models\InventoryMovement;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class InventoryLedgerIntegrityTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Sanctum::actingAs(User::create([
            'username' => 'inventory_ledger_admin', 'full_name' => 'Inventory Ledger Admin',
            'password' => 'irrelevant', 'role' => 'admin', 'is_active' => true,
            'can_receive_notifications' => true,
        ]));
        InventoryMovement::query(); // Register model hooks before test failure/observation hooks.
    }

    private function payload(array $overrides = []): array
    {
        return array_replace([
            'name' => 'Ledger stock', 'unit' => 'kg',
            'current_quantity' => '1.25', 'min_threshold' => '0.75',
        ], $overrides);
    }

    public function test_opening_stock_records_decimal_movement_and_notifies_only_after_commit(): void
    {
        $notificationsDuringInsert = null;
        InventoryMovement::created(function () use (&$notificationsDuringInsert) {
            $notificationsDuringInsert = Notification::count();
        });

        $response = $this->postJson('/api/inventory', $this->payload())
            ->assertCreated()->assertJsonPath('data.current_quantity', '1.25');

        $this->assertSame(0, $notificationsDuringInsert);
        $this->assertDatabaseHas('inventory_movements', [
            'inventory_item_id' => $response->json('data.id'), 'type' => 'in', 'quantity' => 1.25,
        ]);
        $this->assertDatabaseCount('inventory_movements', 1);
        $this->assertDatabaseCount('notifications', 1);
    }

    public function test_zero_opening_stock_has_no_movement_or_stock_notification(): void
    {
        $this->postJson('/api/inventory', $this->payload(['current_quantity' => '0']))
            ->assertCreated()->assertJsonPath('data.current_quantity', '0.00');
        $this->assertDatabaseCount('inventory_items', 1);
        $this->assertDatabaseCount('inventory_movements', 0);
        $this->assertDatabaseCount('notifications', 0);
    }

    public function test_opening_movement_insert_failure_rolls_back_the_item(): void
    {
        InventoryMovement::creating(function () {
            throw new \RuntimeException('Synthetic movement insert failure');
        });

        $this->postJson('/api/inventory', $this->payload())->assertStatus(500);
        $this->assertDatabaseCount('inventory_items', 0);
        $this->assertDatabaseCount('inventory_movements', 0);
        $this->assertDatabaseCount('notifications', 0);
    }

    public function test_failure_after_movement_insert_discards_stock_and_pending_notification(): void
    {
        InventoryMovement::created(function () {
            throw new \RuntimeException('Synthetic post-insert failure');
        });

        $this->postJson('/api/inventory', $this->payload())->assertStatus(500);
        $this->assertDatabaseCount('inventory_items', 0);
        $this->assertDatabaseCount('inventory_movements', 0);
        $this->assertDatabaseCount('notifications', 0);
    }

    public static function balanceChanges(): array
    {
        return ['increase' => ['15.25'], 'decrease' => ['5.75']];
    }

    #[DataProvider('balanceChanges')]
    public function test_metadata_edit_cannot_replace_stock_balance(string $quantity): void
    {
        $item = InventoryItem::create($this->payload(['current_quantity' => '10']));
        $this->putJson('/api/inventory/'.$item->id, $this->payload([
            'name' => 'Must not persist', 'current_quantity' => $quantity,
        ]))->assertUnprocessable()->assertJsonValidationErrors('current_quantity');

        $this->assertSame('10.00', $item->fresh()->current_quantity);
        $this->assertSame('Ledger stock', $item->fresh()->name);
        $this->assertDatabaseCount('inventory_movements', 0);
        $this->assertDatabaseCount('notifications', 0);
    }

    public function test_metadata_edit_accepts_unchanged_decimal_quantity_without_a_movement(): void
    {
        $item = InventoryItem::create($this->payload(['current_quantity' => '10']));
        $this->putJson('/api/inventory/'.$item->id, $this->payload([
            'name' => 'Renamed stock', 'current_quantity' => '10.00',
        ]))->assertOk()->assertJsonPath('data.name', 'Renamed stock')
            ->assertJsonPath('data.min_threshold', '0.75');
        $this->assertSame('10.00', $item->fresh()->current_quantity);
        $this->assertDatabaseCount('inventory_movements', 0);
        $this->assertDatabaseCount('notifications', 0);
    }

    public function test_metadata_without_quantity_preserves_general_and_daily_stock(): void
    {
        $item = InventoryItem::create($this->payload(['current_quantity' => '10', 'reserved_quantity' => '2']));
        $daily = DailyInventoryItem::create(['name' => 'Independent daily stock', 'unit' => 'kg', 'current_quantity' => '20']);
        $payload = $this->payload(['name' => 'Metadata only']);
        unset($payload['current_quantity']);

        $this->putJson('/api/inventory/'.$item->id, $payload)->assertOk();
        $this->assertSame('10.00', $item->fresh()->current_quantity);
        $this->assertSame('2.00', $item->fresh()->reserved_quantity);
        $this->assertEquals(20, $daily->fresh()->current_quantity);
        $this->assertDatabaseCount('inventory_movements', 0);
    }

    public function test_balance_edit_below_reservations_is_rejected(): void
    {
        $item = InventoryItem::create($this->payload(['current_quantity' => '10', 'reserved_quantity' => '2']));
        $this->putJson('/api/inventory/'.$item->id, $this->payload(['current_quantity' => '1']))
            ->assertUnprocessable()->assertJsonValidationErrors('current_quantity');
        $this->assertSame('10.00', $item->fresh()->current_quantity);
        $this->assertSame('2.00', $item->fresh()->reserved_quantity);
        $this->assertDatabaseCount('inventory_movements', 0);
    }

    public function test_existing_adjustment_workflow_records_each_decimal_delta(): void
    {
        $item = InventoryItem::create($this->payload());
        $this->postJson('/api/inventory/'.$item->id.'/adjust', [
            'type' => 'in', 'quantity' => '0.75', 'reason' => 'Synthetic incoming stock',
        ])->assertOk()->assertJsonPath('data.current_quantity', '2.00');
        $this->postJson('/api/inventory/'.$item->id.'/adjust', [
            'type' => 'out', 'quantity' => '0.75', 'reason' => 'Synthetic outgoing stock',
        ])->assertOk()->assertJsonPath('data.current_quantity', '1.25');
        $this->assertDatabaseCount('inventory_movements', 2);
        $this->assertDatabaseHas('inventory_movements', ['inventory_item_id' => $item->id, 'type' => 'in', 'quantity' => 0.75]);
        $this->assertDatabaseHas('inventory_movements', ['inventory_item_id' => $item->id, 'type' => 'out', 'quantity' => 0.75]);
    }

    public function test_warehouse_user_without_edit_permission_cannot_adjust_stock(): void
    {
        $item = InventoryItem::create($this->payload());
        Sanctum::actingAs(User::create([
            'username' => 'warehouse_view_only', 'full_name' => 'Warehouse Viewer',
            'password' => 'irrelevant', 'role' => 'warehouse', 'is_active' => true,
            'permissions' => ['warehouse' => ['view' => true, 'edit' => false]],
        ]));
        $this->postJson('/api/inventory/'.$item->id.'/adjust', [
            'type' => 'in', 'quantity' => '0.75', 'reason' => 'Must be denied',
        ])->assertForbidden();
        $this->assertSame('1.25', $item->fresh()->current_quantity);
        $this->assertDatabaseCount('inventory_movements', 0);
    }
}
