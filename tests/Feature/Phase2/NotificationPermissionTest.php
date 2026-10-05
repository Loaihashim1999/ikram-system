<?php

namespace Tests\Feature\Phase2;

use App\Models\Beneficiary;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class NotificationPermissionTest extends TestCase
{
    use RefreshDatabase;

    public function test_owner_can_read_notification_until_target_permission_is_removed(): void
    {
        $owner = $this->user('EKRAM-E2E-TEST notification owner', 'reception');
        $other = $this->user('EKRAM-E2E-TEST notification other', 'staff');
        $recordId = (string) Str::uuid();
        $secret = 'EKRAM-E2E-TEST beneficiary notice '.$recordId;
        $deepLink = '/beneficiaries/'.$recordId;
        $notice = Notification::create([
            'category' => 'system_event',
            'title' => 'تحديث المستفيدين',
            'event_type' => 'beneficiary_changed',
            'recipient_type' => 'staff',
            'recipient_id' => $owner->id,
            'related_record_type' => Beneficiary::class,
            'related_record_id' => $recordId,
            'message_body' => $secret,
            'action_url' => $deepLink,
            'status' => 'sent',
        ]);

        Sanctum::actingAs($owner);
        $this->getJson('/api/notifications')->assertOk()
            ->assertJsonPath('data.0.id', $notice->id)
            ->assertJsonPath('data.0.message_body', $secret)
            ->assertJsonPath('data.0.action_url', $deepLink)
            ->assertJsonPath('data.0.related_record_id', $recordId);
        $this->getJson('/api/notifications/unread-count')->assertOk()->assertJsonPath('unread_count', 1);

        Sanctum::actingAs($other);
        $denied = $this->getJson('/api/notifications')->assertOk();
        $denied->assertJsonCount(0, 'data');
        $this->assertStringNotContainsString($secret, $denied->getContent());
        $this->assertStringNotContainsString($recordId, $denied->getContent());
        $this->assertStringNotContainsString($deepLink, $denied->getContent());
        $this->getJson('/api/notifications/unread-count')->assertOk()->assertJsonPath('unread_count', 0);
        $this->postJson('/api/notifications/'.$notice->id.'/mark-as-read')->assertNotFound();
        $this->assertNull($notice->fresh()->read_at);

        $owner->update(['permissions' => ['beneficiaries' => ['view' => false, 'notifications' => true]]]);
        $owner->refresh();
        Sanctum::actingAs($owner);
        $hidden = $this->getJson('/api/notifications')->assertOk();
        $hidden->assertJsonCount(0, 'data');
        $this->assertStringNotContainsString($secret, $hidden->getContent());
        $this->assertStringNotContainsString($recordId, $hidden->getContent());
        $this->assertStringNotContainsString($deepLink, $hidden->getContent());
        $this->getJson('/api/notifications/unread-count')->assertOk()->assertJsonPath('unread_count', 0);
        $marked = $this->postJson('/api/notifications/'.$notice->id.'/mark-as-read')->assertNotFound();
        $this->assertStringNotContainsString($secret, $marked->getContent());
        $this->assertStringNotContainsString($recordId, $marked->getContent());
        $this->assertNull($notice->fresh()->read_at);
        $this->assertSame($secret, $notice->fresh()->message_body);
        $this->assertSame($deepLink, $notice->fresh()->action_url);
    }

    public function test_support_notification_hides_when_the_notifications_grant_is_removed(): void
    {
        $owner = $this->user('EKRAM-E2E-TEST support notice owner', 'staff');
        $owner->update(['permissions' => ['support' => ['view' => true, 'notifications' => true]]]);
        $recordId = (string) Str::uuid();
        $secret = 'EKRAM-E2E-TEST support notice '.$recordId;
        $deepLink = '/delivery?task='.$recordId;
        $notice = Notification::create([
            'category' => 'system_event',
            'title' => 'تحديث عمليات التوزيع',
            'event_type' => 'support_assigned',
            'recipient_type' => 'staff',
            'recipient_id' => $owner->id,
            'related_record_type' => 'App\\Models\\SupportDistribution',
            'related_record_id' => $recordId,
            'message_body' => $secret,
            'action_url' => $deepLink,
            'status' => 'sent',
        ]);

        Sanctum::actingAs($owner);
        $this->getJson('/api/notifications')->assertOk()
            ->assertJsonPath('data.0.message_body', $secret)
            ->assertJsonPath('data.0.action_url', $deepLink)
            ->assertJsonPath('data.0.related_record_id', $recordId);

        $owner->update(['permissions' => ['support' => ['view' => true, 'notifications' => false]]]);
        $owner->refresh();
        Sanctum::actingAs($owner);
        $hidden = $this->getJson('/api/notifications')->assertOk();
        $hidden->assertJsonCount(0, 'data');
        $this->assertStringNotContainsString($secret, $hidden->getContent());
        $this->assertStringNotContainsString($recordId, $hidden->getContent());
        $this->assertStringNotContainsString($deepLink, $hidden->getContent());
        $this->getJson('/api/notifications/unread-count')->assertOk()->assertJsonPath('unread_count', 0);
        $this->postJson('/api/notifications/'.$notice->id.'/mark-as-read')->assertNotFound();
        $this->assertNull($notice->fresh()->read_at);
        $this->assertSame($secret, $notice->fresh()->message_body);
    }

    public function test_notification_without_an_event_type_is_not_disclosed(): void
    {
        $owner = $this->user('EKRAM-E2E-TEST blank event owner', 'reception');
        $recordId = (string) Str::uuid();
        $secret = 'EKRAM-E2E-TEST blank event '.$recordId;
        $deepLink = '/beneficiaries/'.$recordId;
        $notice = Notification::create([
            'category' => 'system_event',
            'title' => 'تحديث المستفيدين',
            'event_type' => '',
            'recipient_type' => 'staff',
            'recipient_id' => $owner->id,
            'related_record_type' => Beneficiary::class,
            'related_record_id' => $recordId,
            'message_body' => $secret,
            'action_url' => $deepLink,
            'status' => 'sent',
        ]);

        Sanctum::actingAs($owner);
        $hidden = $this->getJson('/api/notifications')->assertOk();
        $hidden->assertJsonCount(0, 'data');
        $this->assertStringNotContainsString($secret, $hidden->getContent());
        $this->assertStringNotContainsString($recordId, $hidden->getContent());
        $this->assertStringNotContainsString($deepLink, $hidden->getContent());
        $this->getJson('/api/notifications/unread-count')->assertOk()->assertJsonPath('unread_count', 0);
        $this->postJson('/api/notifications/'.$notice->id.'/mark-as-read')->assertNotFound();
        $this->assertSame($secret, $notice->fresh()->message_body);
        $this->assertSame($deepLink, $notice->fresh()->action_url);
    }

    private function user(string $name, string $role): User
    {
        return User::create([
            'username' => 'EKRAM_E2E_'.Str::lower(Str::random(10)),
            'full_name' => $name,
            'password' => Str::random(40),
            'role' => $role,
            'permissions' => ['beneficiaries' => ['view' => true, 'notifications' => true]],
            'is_active' => true,
            'can_receive_notifications' => true,
        ]);
    }
}
