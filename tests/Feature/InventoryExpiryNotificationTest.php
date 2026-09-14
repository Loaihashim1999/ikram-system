<?php

namespace Tests\Feature;

use App\Models\DailyInventoryItem;
use App\Models\Notification;
use App\Models\Setting;
use App\Models\User;
use App\Services\InventoryAlertService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class InventoryExpiryNotificationTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function admin(): User
    {
        return User::create([
            'username' => 'TEST_'.Str::random(8),
            'full_name' => 'TEST ADMIN',
            'password' => Str::random(40),
            'role' => 'admin',
            'is_active' => true,
            'can_receive_notifications' => true,
        ]);
    }

    public function test_expiry_date_persists_and_api_exposes_all_boundary_states(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-09-14 12:00:00', 'Asia/Riyadh'));
        Setting::set('warehouse_alert_threshold_days', 5);
        Sanctum::actingAs($this->admin());

        $created = $this->postJson('/api/daily-inventory', [
            'name' => 'TEST EXPIRY PERSISTENCE', 'quantity' => 12, 'unit' => 'box',
            'min_threshold' => 2, 'expiry_date' => '2026-09-19',
        ])->assertCreated()
            ->assertJsonPath('data.expiry_date', '2026-09-19')
            ->assertJsonPath('data.remaining_days', 5)
            ->assertJsonPath('data.expiry_status', 'near_expiry');

        $id = $created->json('data.id');
        $this->assertDatabaseHas('daily_inventory_items', ['id' => $id, 'expiry_date' => '2026-09-19']);
        $this->putJson('/api/daily-inventory/'.$id, [
            'name' => 'TEST EXPIRY PERSISTENCE', 'unit' => 'box', 'min_threshold' => 2,
            'expiry_date' => '2026-09-20',
        ])->assertOk()->assertJsonPath('data.expiry_status', 'valid');
        $this->getJson('/api/daily-inventory/'.$id)->assertOk()
            ->assertJsonPath('data.expiry_date', '2026-09-20')
            ->assertJsonPath('data.remaining_days', 6)
            ->assertJsonPath('data.expiry_status', 'valid');

        foreach ([
            [-1, 'expired'], [0, 'expired'], [1, 'near_expiry'], [3, 'near_expiry'],
            [5, 'near_expiry'], [6, 'valid'],
        ] as [$days, $status]) {
            $item = DailyInventoryItem::create([
                'name' => 'TEST BOUNDARY '.$days, 'unit' => 'box', 'current_quantity' => 10,
                'min_threshold' => 1, 'expiry_date' => today()->addDays($days),
            ]);
            $this->assertSame($days, $item->remaining_days);
            $this->assertSame($status, $item->expiry_status);
        }
        $none = DailyInventoryItem::create(['name' => 'TEST NO EXPIRY', 'unit' => 'box', 'current_quantity' => 10, 'min_threshold' => 1]);
        $this->assertNull($none->remaining_days);
        $this->assertNull($none->expiry_status);
    }

    public function test_scan_creates_distinct_deduplicated_near_and_expired_notifications(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-09-14 12:00:00', 'Asia/Riyadh'));
        Setting::set('warehouse_alert_threshold_days', 5);
        $admin = $this->admin();
        $near = DailyInventoryItem::create(['name' => 'TEST NEAR', 'unit' => 'box', 'current_quantity' => 10, 'min_threshold' => 1, 'expiry_date' => today()->addDays(5)]);
        $expired = DailyInventoryItem::create(['name' => 'TEST EXPIRED', 'unit' => 'box', 'current_quantity' => 10, 'min_threshold' => 1, 'expiry_date' => today()]);

        app(InventoryAlertService::class)->scan();
        app(InventoryAlertService::class)->scan();

        $this->assertSame(2, Notification::where('recipient_id', $admin->id)->count());
        $this->assertDatabaseHas('notifications', ['recipient_id' => $admin->id, 'related_record_id' => $near->id, 'action_url' => '/daily-beneficiaries/inventory']);
        $this->assertDatabaseHas('notifications', ['recipient_id' => $admin->id, 'related_record_id' => $expired->id, 'action_url' => '/daily-beneficiaries/inventory']);
        $this->assertStringContainsString('متبقي 5 يوم', Notification::where('related_record_id', $near->id)->value('message_body'));
        $this->assertStringContainsString('منتهي الصلاحية', Notification::where('related_record_id', $expired->id)->value('message_body'));
    }

    public function test_notification_api_denies_an_account_with_notifications_disabled(): void
    {
        $user = User::create([
            'username' => 'TEST_DISABLED', 'full_name' => 'TEST DISABLED',
            'password' => Str::random(40), 'role' => 'assistant_admin', 'is_active' => true,
            'can_receive_notifications' => false,
            'permissions' => ['daily_beneficiaries' => ['view' => true, 'notifications' => true]],
        ]);
        Sanctum::actingAs($user);
        $this->getJson('/api/notifications')->assertForbidden();
        $this->getJson('/api/notifications/unread-count')->assertForbidden();
        $this->postJson('/api/notifications/mark-all-read')->assertForbidden();
    }
}