<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Beneficiary;
use App\Models\InventoryItem;
use App\Models\InventoryMovement;
use App\Models\Organization;
use App\Models\PickupLocation;
use App\Models\Staff;
use App\Models\SupportDistribution;
use App\Models\User;
use App\Services\NotificationService;
use App\Services\SupportDistributionService;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\DataProvider;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\TestCase;

class SupportEngineTest extends TestCase
{
    use RefreshDatabase;

    private User $actor;

    private InventoryItem $stock;

    private PickupLocation $location;

    private Organization $org;

    protected function setUp(): void
    {
        parent::setUp();
        $this->actor = User::create(['username' => 'TEST_support', 'full_name' => 'TEST Support', 'password' => 'test-password', 'role' => 'admin', 'is_active' => true]);
        Sanctum::actingAs($this->actor);
        $this->stock = InventoryItem::create(['name' => 'TEST rice', 'unit' => 'kg', 'current_quantity' => 500, 'min_threshold' => 1]);
        $this->location = PickupLocation::create(['name' => 'TEST pickup']);
        $this->org = Organization::create(['name' => 'TEST organization', 'code' => 'TEST_ORG', 'status' => 'active']);
    }

    private function payload($quantity = '2.50'): array
    {
        return ['recipient_type' => 'organization', 'organization_id' => $this->org->id, 'fulfillment_method' => 'pickup',
            'pickup_location_id' => $this->location->id, 'items' => [['inventory_item_id' => $this->stock->id, 'requested_quantity' => $quantity]]];
    }

    private function createSupport(array $overrides = []): string
    {
        return $this->postJson('/api/support/distributions', array_replace($this->payload(), $overrides))->assertCreated()->json('data.id');
    }

    private function step(string $id, string $action, array $data = [])
    {
        if ($action === 'complete') {
            // Phase 2A inventory state-machine regression. Public completion now requires the Phase 2B challenge (tested separately).
            try {
                $result = app(SupportDistributionService::class)->transition($id, $action, $this->actor->id, $data);

                return TestResponse::fromBaseResponse(response()->json(['data' => $result]));
            } catch (ValidationException $e) {
                return TestResponse::fromBaseResponse(response()->json(['errors' => $e->errors()], 422));
            } catch (HttpException $e) {
                return TestResponse::fromBaseResponse(response()->json([], $e->getStatusCode()));
            }
        }

        return $this->patchJson('/api/support/distributions/'.$id.'/'.$action, $data);
    }

    private function ready(string $id): void
    {
        foreach (['approve', 'reserve', 'ready'] as $action) {
            $this->step($id, $action)->assertOk();
        }
    }

    public static function quantities(): array
    {
        return [['1'], ['25'], ['2.5'], ['0.75'], ['300']];
    }

    #[DataProvider('quantities')]
    public function test_full_completion_preserves_decimal_quantities($quantity): void
    {
        $id = $this->createSupport(['items' => [['inventory_item_id' => $this->stock->id, 'requested_quantity' => $quantity]]]);
        $this->ready($id);
        $this->assertSame(number_format((float) $quantity, 2, '.', ''), $this->stock->fresh()->reserved_quantity);
        $this->step($id, 'complete')->assertOk();
        $balance = bcsub('500', $quantity, 2);
        $this->assertSame($balance, $this->stock->fresh()->current_quantity);
        $this->assertSame('0.00', $this->stock->fresh()->reserved_quantity);
        $this->assertDatabaseHas('inventory_movements', ['support_distribution_id' => $id, 'type' => 'out', 'quantity' => $quantity, 'balance_after' => $balance, 'user_id' => $this->actor->id]);
        $this->assertDatabaseHas('audit_logs', ['target_id' => $id, 'action' => 'COMPLETED']);
    }

    public static function invalidQuantities(): array
    {
        return [[0], [-1], ['0.001'], ['bad'], ['10000000000']];
    }

    #[DataProvider('invalidQuantities')]
    public function test_invalid_quantity_is_rejected($quantity): void
    {
        $this->postJson('/api/support/distributions', $this->payload($quantity))->assertUnprocessable();
    }

    public function test_beneficiary_and_staff_are_real_recipients(): void
    {
        $b = Beneficiary::create(['full_name' => 'TEST recipient', 'national_id' => '1234567890', 'phone' => '0501234567', 'beneficiary_type' => 'citizen']);
        \Tests\Support\EligibleSupport::approve($b, $this->actor);
        $s = Staff::create(['name' => 'TEST employee', 'national_id' => '2234567890', 'phone' => '0501234568', 'job_title' => 'TEST', 'department' => 'TEST', 'hire_date' => '2026-01-01', 'phone' => '0501234568', 'status' => 'active']);
        foreach ([['beneficiary', $b], ['staff', $s]] as [$type,$recipient]) {
            $id = $this->createSupport(['recipient_type' => $type, 'organization_id' => null, $type.'_id' => $recipient->id]);
            $this->assertDatabaseHas('support_distributions', ['id' => $id, 'recipient_reference' => (string) $recipient->id]);
            $this->assertNotSame($recipient->national_id, SupportDistribution::find($id)->recipient_reference);
        }
    }

    public function test_mixed_recipient_rejected_by_api_and_service(): void
    {
        $s = Staff::create(['name' => 'TEST employee', 'national_id' => '2234567890', 'phone' => '0501234568', 'job_title' => 'TEST', 'department' => 'TEST', 'hire_date' => '2026-01-01']);
        $data = $this->payload() + ['staff_id' => $s->id];
        $this->postJson('/api/support/distributions', $data)->assertUnprocessable();
        $this->expectException(ValidationException::class);
        app(SupportDistributionService::class)->create($data, $this->actor->id);
    }

    public function test_missing_recipient_rejected(): void
    {
        $data = $this->payload();
        unset($data['organization_id']);
        $this->postJson('/api/support/distributions', $data)->assertUnprocessable();
    }

    public function test_multiple_items_and_atomic_insufficient_stock(): void
    {
        $other = InventoryItem::create(['name' => 'TEST other', 'unit' => 'kg', 'current_quantity' => 1]);
        $data = $this->payload();
        $data['items'][] = ['inventory_item_id' => $other->id, 'requested_quantity' => 2];
        $id = $this->createSupport($data);
        $this->step($id, 'approve')->assertOk();
        $this->step($id, 'reserve')->assertUnprocessable();
        $this->assertSame('0.00', $this->stock->fresh()->reserved_quantity);
        $this->assertSame('approved', SupportDistribution::find($id)->status);
        $other->update(['current_quantity' => 3]);
        $this->step($id, 'reserve')->assertOk();
        $this->step($id, 'ready')->assertOk();
        $this->step($id, 'complete')->assertOk();
        $this->assertSame(2, InventoryMovement::where('support_distribution_id', $id)->count());
    }

    public function test_duplicate_items_rejected(): void
    {
        $data = $this->payload();
        $data['items'][] = $data['items'][0];
        $this->postJson('/api/support/distributions', $data)->assertUnprocessable();
    }

    public static function cancellationStates(): array
    {
        return [['draft'], ['approved'], ['reserved'], ['ready']];
    }

    #[DataProvider('cancellationStates')]
    public function test_cancellation_releases_only_own_reservation(string $state): void
    {
        $other = $this->createSupport();
        $this->step($other, 'approve');
        $this->step($other, 'reserve');
        $id = $this->createSupport();
        foreach (['draft' => null, 'approved' => 'approve', 'reserved' => 'reserve', 'ready' => 'ready'] as $status => $action) {
            if ($action) {
                $this->step($id, $action)->assertOk();
            } if ($status === $state) {
                break;
            }
        }
        $this->step($id, 'cancel')->assertOk();
        $this->assertSame('2.50', $this->stock->fresh()->reserved_quantity);
        $this->assertSame('500.00', $this->stock->fresh()->current_quantity);
    }

    public function test_delivery_dispatch_and_cancel_block(): void
    {
        $driver = (string) Str::uuid();
        DB::table('drivers')->insert(['id' => $driver, 'full_name' => 'TEST driver', 'phone' => '0501234567', 'is_active' => true]);
        $id = $this->createSupport(['fulfillment_method' => 'delivery', 'pickup_location_id' => null, 'driver_id' => $driver]);
        $this->ready($id);
        $this->step($id, 'complete')->assertUnprocessable();
        $this->step($id, 'dispatch')->assertOk();
        $this->step($id, 'cancel')->assertUnprocessable();
        $this->step($id, 'complete')->assertOk();
    }

    public function test_dispatch_requires_driver(): void
    {
        $id = $this->createSupport(['fulfillment_method' => 'delivery', 'pickup_location_id' => null]);
        $this->ready($id);
        $this->step($id, 'dispatch')->assertUnprocessable();
    }

    public function test_duplicate_completion_is_conflict_and_terminal(): void
    {
        $id = $this->createSupport();
        $this->ready($id);
        $this->step($id, 'complete')->assertOk();
        $this->step($id, 'complete')->assertConflict();
        $this->step($id, 'cancel')->assertUnprocessable();
        $this->assertSame(1, InventoryMovement::where('support_distribution_id', $id)->count());
    }

    public function test_illegal_transition_and_cancelled_terminal(): void
    {
        $id = $this->createSupport();
        $this->step($id, 'reserve')->assertUnprocessable();
        $this->step($id, 'complete')->assertUnprocessable();
        $this->step($id, 'cancel')->assertOk();
        $this->step($id, 'approve')->assertUnprocessable();
    }

    public function test_partial_fulfillment_rejected(): void
    {
        $id = $this->createSupport();
        $this->ready($id);
        $this->step($id, 'complete', ['fulfilled_quantity' => 1])->assertUnprocessable();
        $this->assertSame('500.00', $this->stock->fresh()->current_quantity);
    }

    public function test_competing_reservations_cannot_exceed_availability(): void
    {
        $this->stock->update(['current_quantity' => 3]);
        $a = $this->createSupport();
        $b = $this->createSupport();
        $this->step($a, 'approve');
        $this->step($b, 'approve');
        $this->step($a, 'reserve')->assertOk();
        $this->step($b, 'reserve')->assertUnprocessable();
        $this->assertSame('0.50', $this->stock->fresh()->available_quantity);
    }

    public function test_draft_edit_only_and_snapshot(): void
    {
        $id = $this->createSupport();
        $this->patchJson('/api/support/distributions/'.$id, ['notes' => 'TEST edit'])->assertOk();
        $this->location->update(['name' => 'NEW']);
        $this->assertSame('TEST pickup', SupportDistribution::find($id)->pickup_location_name);
        $this->step($id, 'approve');
        $this->patchJson('/api/support/distributions/'.$id, ['notes' => 'forged'])->assertUnprocessable();
    }

    public function test_pickup_deactivation_and_history_protection(): void
    {
        $id = $this->createSupport();
        $this->deleteJson('/api/support/pickup-locations/'.$this->location->id)->assertUnprocessable();
        $this->patchJson('/api/support/pickup-locations/'.$this->location->id, ['is_active' => false])->assertOk();
        $this->postJson('/api/support/distributions', $this->payload())->assertUnprocessable();
        $this->assertDatabaseHas('support_distributions', ['id' => $id]);
        $unused = PickupLocation::create(['name' => 'UNUSED']);
        $this->deleteJson('/api/support/pickup-locations/'.$unused->id)->assertOk();
        $this->assertDatabaseMissing('pickup_locations', ['id' => $unused->id]);
    }

    public function test_inventory_reference_delete_protected(): void
    {
        $this->createSupport();
        $this->deleteJson('/api/inventory/'.$this->stock->id)->assertUnprocessable();
    }

    public function test_legacy_inventory_update_guard(): void
    {
        $this->stock->update(['current_quantity' => 100, 'reserved_quantity' => 60]);
        $this->putJson('/api/inventory/'.$this->stock->id, ['name' => 'TEST', 'unit' => 'kg', 'min_threshold' => 1, 'current_quantity' => 40])->assertUnprocessable();
        $this->assertSame('100.00', $this->stock->fresh()->current_quantity);
        $this->assertSame('60.00', $this->stock->fresh()->reserved_quantity);
        $this->postJson('/api/inventory/'.$this->stock->id.'/adjust', ['type' => 'out', 'quantity' => 41, 'reason' => 'TEST'])->assertUnprocessable();
    }

    public function test_invariant_corruption_surfaces(): void
    {
        $stock = new InventoryItem(['current_quantity' => 1, 'reserved_quantity' => 2]);
        $this->expectException(\LogicException::class);
        $stock->available_quantity;
    }

    public static function settingsFailures(): array
    {
        return [['unknown', 1], ['resident_degree_threshold', 1], ['resident_need_threshold', -1], ['first_class_max_income', 'bad']];
    }

    #[DataProvider('settingsFailures')]
    public function test_settings_reject_invalid_keys_and_values($key, $value): void
    {
        $this->postJson('/api/settings', [$key => $value])->assertUnprocessable();
    }

    public function test_settings_accept_canonical_key(): void
    {
        $this->postJson('/api/settings', ['resident_need_threshold' => 2500])->assertOk();
        $this->assertDatabaseHas('settings', ['key' => 'resident_need_threshold', 'value' => '2500']);
    }

    public function test_permissions_deny_missing_and_edit_does_not_approve(): void
    {
        $id = $this->createSupport();
        $this->actor->update(['role' => 'assistant_admin', 'permissions' => []]);
        Sanctum::actingAs($this->actor);
        $this->getJson('/api/support/distributions')->assertForbidden();
        $this->step($id, 'approve')->assertForbidden();
        $this->actor->update(['permissions' => ['support' => ['edit' => true]]]);
        Sanctum::actingAs($this->actor);
        $this->step($id, 'approve')->assertForbidden();
    }

    public function test_approve_and_cancel_independent_of_edit(): void
    {
        $id = $this->createSupport();
        $this->actor->update(['role' => 'assistant_admin', 'permissions' => ['support' => ['approve' => true, 'cancel' => true]]]);
        Sanctum::actingAs($this->actor);
        $this->step($id, 'approve')->assertOk();
        $this->step($id, 'reserve')->assertForbidden();
        $this->step($id, 'cancel')->assertOk();
    }

    public function test_history_is_item_specific_and_population_scoped(): void
    {
        $id = $this->createSupport();
        $this->ready($id);
        $this->step($id, 'complete');
        SupportDistribution::find($id)->update(['completed_at' => now()->subDays(10)]);
        $other = InventoryItem::create(['name' => 'OTHER', 'unit' => 'kg', 'current_quantity' => 10]);
        $base = '/api/support/history?population=organizations&inventory_item_id=';
        $this->getJson($base.$this->stock->id)->assertOk()->assertJsonPath('data.0.total_received_in_period', '2.50')->assertJsonPath('data.0.days_since_received', 10);
        $this->getJson($base.$this->stock->id.'&never_received=1')->assertJsonCount(0, 'data');
        $this->getJson($base.$other->id.'&never_received=1')->assertJsonCount(1, 'data');
        $this->getJson($base.$this->stock->id.'&not_received_days=5')->assertJsonCount(1, 'data');
        $this->getJson($base.$this->stock->id.'&not_received_days=20')->assertJsonCount(0, 'data');
        $this->getJson($base.$this->stock->id.'&not_received_since='.now()->subDays(5)->toDateString())->assertJsonCount(1, 'data');
        $this->getJson($base.$this->stock->id.'&from='.now()->subDays(5)->toDateString())->assertJsonPath('data.0.total_received_in_period', '0.00');
        $this->getJson('/api/support/history?population=staff&inventory_item_id='.$this->stock->id)->assertJsonCount(0, 'data');
    }

    public function test_audit_failure_rolls_back_business_change(): void
    {
        $id = $this->createSupport();
        AuditLog::creating(function () {
            throw new \RuntimeException('TEST audit unavailable');
        });
        try {
            app(SupportDistributionService::class)->transition($id, 'approve', $this->actor->id);
            $this->fail('Expected audit failure');
        } catch (\RuntimeException $e) {
            $this->assertSame('TEST audit unavailable', $e->getMessage());
        } finally {
            AuditLog::flushEventListeners();
        }
        $this->assertSame('draft', SupportDistribution::find($id)->status);
    }

    public function test_notification_permission_filter(): void
    {
        $yes = User::create(['username' => 'TEST_yes', 'full_name' => 'YES', 'password' => 'test', 'role' => 'assistant_admin', 'is_active' => true, 'can_receive_notifications' => true, 'permissions' => ['support' => ['notifications' => true]]]);
        $no = User::create(['username' => 'TEST_no', 'full_name' => 'NO', 'password' => 'test', 'role' => 'assistant_admin', 'is_active' => true, 'can_receive_notifications' => true, 'permissions' => ['support' => ['view' => true]]]);
        $id = $this->createSupport();
        NotificationService::notifyAll('support_created', 'TEST', SupportDistribution::find($id));
        $this->assertDatabaseHas('notifications', ['recipient_id' => $yes->id, 'related_record_id' => $id, 'action_url' => null]);
        $this->assertDatabaseMissing('notifications', ['recipient_id' => $no->id, 'related_record_id' => $id]);
    }

    public function test_decimal_rollback_refuses_fractional_data(): void
    {
        $this->stock->update(['current_quantity' => '2.50']);
        $migration = require database_path('migrations/2026_09_19_040000_widen_general_warehouse_quantities_to_decimal.php');
        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('Cannot roll back decimal widening');
        $migration->down();
    }

    public function test_legacy_distribution_cannot_consume_reserved_stock(): void
    {
        $staff = Staff::create(['name' => 'TEST employee', 'national_id' => '3234567890', 'phone' => '0501234568', 'job_title' => 'TEST', 'hire_date' => '2026-01-01']);
        $this->stock->update(['current_quantity' => 1, 'reserved_quantity' => 1]);
        $this->postJson('/api/distributions', ['staff_ids' => [$staff->id], 'basket_id' => $this->stock->id, 'scheduled_at' => '2026-09-20'])->assertUnprocessable();
        $this->assertDatabaseCount('staff_distributions', 0);
        $this->assertSame('1.00', $this->stock->fresh()->current_quantity);
    }

    public function test_completion_audit_failure_rolls_back_inventory_and_movements(): void
    {
        $id = $this->createSupport();
        $this->ready($id);
        AuditLog::creating(function () {
            throw new \RuntimeException('TEST audit failure');
        });
        try {
            app(SupportDistributionService::class)->transition($id, 'complete', $this->actor->id);
            $this->fail('Audit must be mandatory');
        } catch (\RuntimeException $e) {
            $this->assertSame('TEST audit failure', $e->getMessage());
        } finally {
            AuditLog::flushEventListeners();
        }
        $this->assertSame('ready', SupportDistribution::find($id)->status);
        $this->assertSame('500.00', $this->stock->fresh()->current_quantity);
        $this->assertSame('2.50', $this->stock->fresh()->reserved_quantity);
        $this->assertDatabaseMissing('inventory_movements', ['support_distribution_id' => $id]);
    }

    public function test_recipient_deletion_cannot_remove_support_history(): void
    {
        $id = $this->createSupport();
        try {
            DB::transaction(fn () => $this->org->delete());
            $this->fail('Recipient FK must protect history');
        } catch (QueryException $e) {
            $this->assertDatabaseHas('support_distributions', ['id' => $id, 'organization_id' => $this->org->id]);
        }
    }
}
