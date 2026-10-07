<?php

namespace Tests\Feature\Phase6;

use App\Contracts\Communications\SmsProviderInterface;
use App\Jobs\SendCommunication;
use App\Models\AuditLog;
use App\Models\Beneficiary;
use App\Models\Notification;
use App\Models\User;
use App\Services\Communications\FakeSmsProvider;
use App\Services\Communications\SaudiPhoneNumber;
use App\Services\NotificationService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class NotificationRetentionTest extends TestCase
{
    use RefreshDatabase;

    public function test_lists_are_paginated_scoped_and_permissions_stay_separate(): void
    {
        $owner = $this->user('owner', 'reception');
        $other = $this->user('other', 'staff');
        foreach (range(1, 25) as $index) {
            $this->notice($owner, 'beneficiary_changed', 'ملاحظة '.$index);
        }
        $foreign = $this->notice($other, 'beneficiary_changed', 'سر الطرف الآخر');
        Sanctum::actingAs($owner);
        $page = $this->getJson('/api/notifications?per_page=10&page=2')->assertOk();
        $page->assertJsonPath('current_page', 2)->assertJsonPath('per_page', 10)->assertJsonPath('total', 25)->assertJsonPath('last_page', 3);
        $this->assertCount(10, $page->json('data'));
        $this->assertStringNotContainsString('سر الطرف الآخر', $page->getContent());
        $this->getJson('/api/notifications/unread-count')->assertOk()->assertJsonPath('unread_count', 25);
        Sanctum::actingAs($other);
        $this->getJson('/api/notifications/unread-count')->assertOk()->assertJsonPath('unread_count', 1);
        $this->assertNotSame($owner->id, $foreign->recipient_id);

        $support = $this->user('support', 'staff', ['support' => ['view' => true, 'notifications' => true]]);
        $secret = $this->notice($support, 'support_assigned', 'إشعار دعم');
        Sanctum::actingAs($support);
        $this->getJson('/api/notifications')->assertOk()->assertJsonPath('data.0.id', $secret->id);
        $support->update(['permissions' => ['support' => ['view' => true, 'notifications' => false]]]);
        Sanctum::actingAs($support->fresh());
        $this->getJson('/api/notifications')->assertOk()->assertJsonCount(0, 'data');

        $blank = $this->user('blank', 'reception');
        $this->notice($blank, '', 'حدث بلا نوع');
        Sanctum::actingAs($blank);
        $this->getJson('/api/notifications')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/notifications/unread-count')->assertOk()->assertJsonPath('unread_count', 0);
    }

    public function test_read_and_permanent_delete_stay_inside_the_recipient_boundary(): void
    {
        $owner = $this->user('deleter', 'staff', ['beneficiaries' => ['view' => true, 'notifications' => true], 'notifications' => ['delete' => true]]);
        $other = $this->user('foreign', 'staff');
        $mine = $this->notice($owner, 'beneficiary_changed', 'إشعاري');
        $unread = $this->notice($owner, 'beneficiary_changed', 'غير مقروء');
        $foreign = $this->notice($other, 'beneficiary_changed', 'إشعار غيري');
        $beneficiary = Beneficiary::create(['beneficiary_type' => 'citizen', 'full_name' => 'EKRAM-E2E-TEST ثابت', 'national_id' => '1900000991', 'phone' => '0500000991', 'family_status' => 'poor', 'family_members_count' => 1, 'housing_type' => 'own', 'status' => 'active']);
        $audit = AuditLog::create(['user_id' => $owner->id, 'action' => 'TEST_KEEP', 'target_table' => 'beneficiaries', 'target_id' => $beneficiary->id, 'details' => []]);
        Sanctum::actingAs($owner);

        $this->postJson('/api/notifications/'.$mine->id.'/mark-as-read')->assertOk();
        $this->assertNotNull($mine->fresh()->read_at);
        $this->postJson('/api/notifications/mark-all-read')->assertOk();
        $this->assertNotNull($unread->fresh()->read_at);
        $unread->update(['read_at' => null]);

        $this->deleteJson('/api/notifications/'.$mine->id)->assertOk()->assertJsonPath('deleted_count', 1);
        $this->assertNull($mine->fresh());
        $this->deleteJson('/api/notifications/'.$foreign->id)->assertNotFound();
        $this->assertNotNull($foreign->fresh());

        $second = $this->notice($owner, 'beneficiary_changed', 'ثاني');
        $second->update(['read_at' => now()]);
        $this->postJson('/api/notifications/delete-selected', ['ids' => [$second->id, $foreign->id]])->assertOk()->assertJsonPath('deleted_count', 1);
        $this->assertNull($second->fresh());
        $this->assertNotNull($foreign->fresh());

        $read = $this->notice($owner, 'beneficiary_changed', 'مقروء للحذف');
        $read->update(['read_at' => now()]);
        $this->postJson('/api/notifications/delete-read')->assertOk();
        $this->assertNull($read->fresh());
        $this->assertNotNull($unread->fresh());
        $this->assertNotNull($beneficiary->fresh());
        $this->assertNotNull($audit->fresh());

        $denied = $this->user('nodelete', 'staff');
        $kept = $this->notice($denied, 'beneficiary_changed', 'بلا صلاحية حذف');
        Sanctum::actingAs($denied);
        $this->deleteJson('/api/notifications/'.$kept->id)->assertForbidden();
        $this->assertNotNull($kept->fresh());
    }

    public function test_purge_is_separate_and_prune_keeps_unread_rows(): void
    {
        $admin = $this->user('admin', 'admin');
        $deleter = $this->user('only-delete', 'staff', ['notifications' => ['delete' => true], 'beneficiaries' => ['view' => true, 'notifications' => true]]);
        $oldRead = $this->notice($admin, 'beneficiary_changed', 'قديم مقروء');
        $oldUnread = $this->notice($admin, 'beneficiary_changed', 'قديم غير مقروء');
        $recent = $this->notice($admin, 'beneficiary_changed', 'حديث مقروء');
        $oldRead->forceFill(['created_at' => now()->subDays(120), 'read_at' => now()->subDay()])->save();
        $oldUnread->forceFill(['created_at' => now()->subDays(120), 'read_at' => null])->save();
        $recent->forceFill(['read_at' => now()])->save();

        Sanctum::actingAs($deleter);
        $this->postJson('/api/notifications/purge', ['days' => 90])->assertForbidden();
        Sanctum::actingAs($admin);
        $this->postJson('/api/notifications/purge', ['before' => now()->addDay()->toDateString()])->assertStatus(422);
        $this->postJson('/api/notifications/purge', ['days' => 90, 'include_unread' => true])->assertStatus(422);
        $this->postJson('/api/notifications/purge', ['days' => 90])->assertOk()->assertJsonPath('deleted_count', 1);
        $this->assertNull($oldRead->fresh());
        $this->assertNotNull($oldUnread->fresh());
        $this->assertNotNull($recent->fresh());

        $another = $this->notice($admin, 'beneficiary_changed', 'للتجربة');
        $another->forceFill(['created_at' => now()->subDays(120), 'read_at' => now()->subDay()])->save();
        $this->artisan('notifications:prune', ['--dry-run' => true, '--days' => 90])->assertOk();
        $this->assertNotNull($another->fresh());
        $chunked = collect(range(1, 3))->map(fn () => tap($this->notice($admin, 'beneficiary_changed', 'دفعة'), function ($row) {
            $row->forceFill(['created_at' => now()->subDays(120), 'read_at' => now()->subDay()])->save();
        }));
        $this->assertSame(3, NotificationService::deleteMatching(Notification::whereIn('id', $chunked->pluck('id')), 1));
        $this->assertSame(0, Notification::whereIn('id', $chunked->pluck('id'))->count());
        $this->artisan('notifications:prune', ['--days' => 90])->assertOk();
        $this->assertNull($another->fresh());
        $this->assertNotNull($oldUnread->fresh());
    }

    public function test_default_retention_is_thirty_days_and_explicit_days_still_override_it(): void
    {
        $this->assertSame(30, config('notifications.retention_days'));
        Carbon::setTestNow(Carbon::parse('2026-10-07 12:00:00'));
        try {
            $admin = $this->user('window', 'admin');
            $read31 = $this->aged($admin, 31, true);
            $read30 = $this->aged($admin, 30, true);
            $read29 = $this->aged($admin, 29, true);
            $unread40 = $this->aged($admin, 40, false);
            $read45 = $this->aged($admin, 45, true);
            $read61 = $this->aged($admin, 61, true);

            $this->artisan('notifications:prune', ['--dry-run' => true])->assertOk();
            $this->assertNotNull($read31->fresh());

            $this->artisan('notifications:prune', ['--days' => 60])->assertOk();
            $this->assertNull($read61->fresh());
            $this->assertNotNull($read45->fresh());
            $this->assertNotNull($read31->fresh());

            $this->artisan('notifications:prune')->assertOk();
            $this->assertNull($read31->fresh());
            $this->assertNull($read45->fresh());
            $this->assertNotNull($read30->fresh());
            $this->assertNotNull($read29->fresh());
            $this->assertNotNull($unread40->fresh());
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_targets_provider_phone_and_webhook_contracts_remain(): void
    {
        $owner = $this->user('linker', 'reception');
        $beneficiary = Beneficiary::create(['beneficiary_type' => 'citizen', 'full_name' => 'EKRAM-E2E-TEST رابط', 'national_id' => '1900000992', 'phone' => '0500000992', 'family_status' => 'poor', 'family_members_count' => 1, 'housing_type' => 'own', 'status' => 'active']);
        $live = $this->notice($owner, 'beneficiary_changed', 'رابط حي', $beneficiary->id, Beneficiary::class);
        $dead = $this->notice($owner, 'beneficiary_changed', 'رابط مفقود');
        Sanctum::actingAs($owner);
        $rows = collect($this->getJson('/api/notifications')->assertOk()->json('data'));
        $this->assertTrue($rows->firstWhere('id', $live->id)['target_available']);
        $this->assertFalse($rows->firstWhere('id', $dead->id)['target_available']);
        $this->assertNotEmpty($rows->firstWhere('id', $dead->id)['action_url']);

        $this->assertSame('966574917155', app(SaudiPhoneNumber::class)->normalize('0574917155'));
        config(['services.communications.provider' => 'fake']);
        $this->assertInstanceOf(FakeSmsProvider::class, $this->app->make(SmsProviderInterface::class));
        $this->assertSame(1, (new SendCommunication('x'))->tries);
        $service = file_get_contents(app_path('Services/Communications/CommunicationService.php'));
        $this->assertStringContainsString("'delivery_state' => 'unconfirmed'", $service);
        $this->assertStringNotContainsString("'delivered_at'", $service);
        $driver = file_get_contents(app_path('Services/Delivery/DriverAccessService.php'));
        $this->assertStringContainsString('publicBaseUrl().\'/driver-access#\'.$token', $driver);
        $this->assertStringContainsString("'temporary_driver_link' => \$this->capabilityUrl(\$token)", $driver);
        $this->postJson('/api/webhooks/taqnyat/sms', ['status' => 'delivered'])->assertStatus(503);
        $this->assertFalse(config('services.taqnyat.sms_webhook.enabled'));
    }

    private function user(string $name, string $role, ?array $permissions = null): User
    {
        return User::create([
            'username' => 'EKRAM_P6_'.Str::lower(Str::random(8)),
            'full_name' => 'EKRAM-E2E-TEST '.$name,
            'password' => 'test-password',
            'role' => $role,
            'permissions' => $permissions ?? ['beneficiaries' => ['view' => true, 'notifications' => true]],
            'is_active' => true,
            'can_receive_notifications' => true,
        ]);
    }

    private function aged(User $user, int $days, bool $read): Notification
    {
        $row = $this->notice($user, 'beneficiary_changed', 'عمر '.$days);
        $row->forceFill([
            'created_at' => now()->subDays($days),
            'read_at' => $read ? now()->subDay() : null,
        ])->save();

        return $row;
    }

    private function notice(User $user, string $event, string $body, ?string $recordId = null, ?string $type = null): Notification
    {
        return Notification::create([
            'category' => 'system_event',
            'title' => 'تنبيه',
            'event_type' => $event,
            'recipient_type' => 'staff',
            'recipient_id' => $user->id,
            'related_record_type' => $type ?? Beneficiary::class,
            'related_record_id' => $recordId ?? (string) Str::uuid(),
            'message_body' => $body,
            'action_url' => '/beneficiaries/'.($recordId ?? 'missing'),
            'status' => 'sent',
        ]);
    }
}
