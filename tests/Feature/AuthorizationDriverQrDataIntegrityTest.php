<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Basket;
use App\Models\Beneficiary;
use App\Models\Distribution;
use App\Models\InventoryItem;
use App\Models\InventoryMovement;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AuthorizationDriverQrDataIntegrityTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $role = 'admin', array $permissions = []): User
    {
        return User::create(['username' => 'TEST_'.Str::random(10), 'full_name' => 'TEST ACTOR', 'password' => Str::random(30), 'role' => $role, 'permissions' => $permissions, 'is_active' => true]);
    }

    public function test_driver_permissions_are_fixed_and_payload_cannot_grant_admin_modules(): void
    {
        Sanctum::actingAs($this->user());
        $response = $this->postJson('/api/users', [
            'username' => 'TEST_DRIVER_FIXED', 'full_name' => 'TEST DRIVER', 'password' => 'StrongDriver123!',
            'role' => 'delivery_driver',
            'permissions' => ['settings' => ['view' => true, 'delete' => true], 'beneficiaries' => ['view' => true]],
        ])->assertCreated();
        $driver = User::findOrFail($response->json('data.id'));
        $this->assertSame(User::DRIVER_PERMISSIONS, $driver->permissions);

        Sanctum::actingAs($driver);
        $this->getJson('/api/users')->assertForbidden();
        $this->getJson('/api/beneficiaries')->assertForbidden();
        $this->getJson('/api/drivers')->assertOk()->assertJsonCount(1, 'data');
    }

    public function test_driver_sees_only_assigned_tasks_and_qr_manual_code_share_secure_flow(): void
    {
        $admin = $this->user();
        $driver = $this->user('delivery_driver', User::DRIVER_PERMISSIONS);
        $other = $this->user('delivery_driver', User::DRIVER_PERMISSIONS);
        $beneficiary = Beneficiary::create(['full_name' => 'TEST QR PERSON', 'national_id' => '7777777777', 'phone' => '0500000000']);
        $basket = Basket::create(['name' => 'TEST QR BASKET', 'stock_quantity' => 10]);
        $assigned = Distribution::create(['beneficiary_id' => $beneficiary->id, 'basket_id' => $basket->id, 'assigned_by' => $admin->id, 'driver_id' => $driver->id, 'scheduled_at' => now(), 'barcode_code' => 'TEST-MANUAL-QR-ONE', 'status' => 'scheduled']);
        Distribution::create(['beneficiary_id' => $beneficiary->id, 'basket_id' => $basket->id, 'assigned_by' => $admin->id, 'driver_id' => $other->id, 'scheduled_at' => now(), 'barcode_code' => 'TEST-MANUAL-QR-TWO', 'status' => 'scheduled']);

        Sanctum::actingAs($driver);
        $this->getJson('/api/drivers/deliveries')->assertOk()
            ->assertJsonCount(1, 'data.beneficiary_deliveries')
            ->assertJsonPath('data.beneficiary_deliveries.0.id', $assigned->id);
        $this->getJson('/api/receiver/scan/test-manual-qr-one')->assertOk()->assertJsonPath('data.id', $assigned->id);
        $this->postJson('/api/receiver/confirm/test-manual-qr-one')->assertOk()->assertJsonPath('distribution.id', $assigned->id);
        $this->postJson('/api/receiver/confirm/test-manual-qr-one')->assertConflict();
        $this->postJson('/api/receiver/confirm/test-manual-qr-two')->assertForbidden();
        $pdf = $this->get('/api/documents/individual-receipt/'.$assigned->id.'/pdf')->assertOk();
        $this->assertStringStartsWith('%PDF', $pdf->getContent());
    }

    public function test_deleting_user_preserves_business_and_actor_snapshot_history(): void
    {
        $admin = $this->user();
        $actor = $this->user('assistant_admin');
        $beneficiary = Beneficiary::create(['full_name' => 'TEST PRESERVED PERSON', 'national_id' => '7666666666', 'phone' => '0500000000', 'created_by' => $actor->id]);
        $basket = Basket::create(['name' => 'TEST PRESERVED BASKET', 'stock_quantity' => 10]);
        $distribution = Distribution::create(['beneficiary_id' => $beneficiary->id, 'basket_id' => $basket->id, 'assigned_by' => $actor->id, 'scheduled_at' => now(), 'barcode_code' => 'TEST-PRESERVED-CODE', 'status' => 'scheduled']);
        $item = InventoryItem::create(['name' => 'TEST PRESERVED ITEM', 'unit' => 'piece', 'current_quantity' => 5, 'min_threshold' => 1]);
        $movement = InventoryMovement::create(['inventory_item_id' => $item->id, 'type' => 'in', 'quantity' => 5, 'reason' => 'TEST', 'user_id' => $actor->id]);
        $audit = AuditLog::create(['user_id' => $actor->id, 'action' => 'TEST_HISTORY', 'target_table' => 'beneficiaries', 'target_id' => $beneficiary->id, 'details' => ['operation' => 'created test beneficiary']]);

        Sanctum::actingAs($admin);
        $this->deleteJson('/api/users/'.$actor->id)->assertOk();
        $this->assertDatabaseHas('beneficiaries', ['id' => $beneficiary->id, 'created_by' => null]);
        $this->assertDatabaseHas('distributions', ['id' => $distribution->id, 'assigned_by' => null]);
        $this->assertDatabaseHas('inventory_movements', ['id' => $movement->id, 'user_id' => null]);
        $this->assertDatabaseHas('audit_logs', ['id' => $audit->id, 'user_id' => null]);
        $this->assertSame('TEST ACTOR', $audit->fresh()->details['actor_name']);
        $this->assertSame('assistant_admin', $audit->fresh()->details['actor_role']);
    }
}
