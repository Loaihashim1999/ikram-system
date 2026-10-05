<?php

namespace Tests\Feature;

use App\Models\Beneficiary;
use App\Models\CommunicationMessage;
use App\Models\InventoryItem;
use App\Models\Notification;
use App\Models\PickupLocation;
use App\Models\User;
use App\Services\Delivery\ReceiptVerificationService;
use App\Services\SupportDistributionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class NotificationRecipientPolicyTest extends TestCase
{
    use RefreshDatabase;

    public function test_disabled_account_neither_receives_nor_reads_receipt_confirmation_notifications(): void
    {
        Queue::fake();
        $enabled = $this->account('TEST_ENABLED_ADMIN', true);
        $disabled = $this->account('TEST_DISABLED_ADMIN', false);
        $beneficiary = Beneficiary::create(['full_name' => 'TEST RECEIPT BENEFICIARY', 'national_id' => '9777777777', 'phone' => '0507777777']);
        $stock = InventoryItem::create(['name' => 'TEST receipt', 'unit' => 'kg', 'current_quantity' => 5, 'min_threshold' => 1]);
        $location = PickupLocation::create(['name' => 'TEST pickup']);
        $service = app(SupportDistributionService::class);
        $support = $service->create(['recipient_type' => 'beneficiary', 'beneficiary_id' => $beneficiary->id, 'fulfillment_method' => 'pickup', 'pickup_location_id' => $location->id, 'items' => [['inventory_item_id' => $stock->id, 'requested_quantity' => '0.75']]], $enabled->id);
        foreach (['approve', 'reserve', 'ready'] as $action) {
            $service->transition($support->id, $action, $enabled->id);
        }
        app(ReceiptVerificationService::class)->issue($support->id, $enabled->id);
        preg_match('/رمز الاستلام: ([0-9]{4})/', CommunicationMessage::first()->encrypted_payload['body'], $match);
        Notification::query()->delete();
        Sanctum::actingAs($enabled);
        $this->postJson('/api/support/distributions/'.$support->id.'/verify', ['code' => $match[1]])->assertOk();
        $this->assertDatabaseHas('notifications', ['recipient_id' => $enabled->id, 'related_record_id' => $support->id, 'event_type' => 'support_receipt_verified', 'action_url' => '/receiver?task='.$support->id, 'category' => 'system_event']);
        $this->assertDatabaseMissing('notifications', ['recipient_id' => $disabled->id]);
        $this->assertTrue(Notification::where('recipient_id', $enabled->id)->where('message_body', 'تم تأكيد استلام الدعم.')->exists());
        Sanctum::actingAs($disabled);
        $this->getJson('/api/notifications')->assertForbidden();
        $this->getJson('/api/notifications/unread-count')->assertForbidden();
    }

    private function account(string $username, bool $canReceiveNotifications): User
    {
        return User::create(['username' => $username.'_'.Str::random(6), 'full_name' => str_replace('_', ' ', $username), 'password' => Str::random(40), 'role' => 'admin', 'is_active' => true, 'can_receive_notifications' => $canReceiveNotifications]);
    }
}
