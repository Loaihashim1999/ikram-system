<?php

namespace Tests\Feature;

use App\Models\Beneficiary;
use App\Models\Category;
use App\Models\DailyBeneficiary;
use App\Models\Driver;
use App\Models\DriverAssignment;
use App\Models\Notification;
use App\Models\Staff;
use App\Models\SupportDistribution;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * FSA Section 7: IDOR / direct-URL security matrix. Cross-owner access must
 * be refused with 401/403/404/410 according to the enforced policy, and no
 * unauthorized data body may leak.
 */
class FsaIdorMatrixTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $username, string $role, array $permissions, bool $notifications = true): User
    {
        return User::create([
            'username' => $username, 'full_name' => 'IDOR '.$username, 'password' => 'idor-password',
            'email' => $username.'@example.invalid', 'role' => $role, 'permissions' => $permissions,
            'is_active' => true, 'can_receive_notifications' => $notifications,
        ]);
    }

    protected function setUp(): void
    {
        parent::setUp();
        $admin = $this->user('idor_admin', 'admin', [], false);
        $category = Category::create(['name' => 'IDOR CATEGORY']);
        $benX = Beneficiary::create(['beneficiary_type' => 'citizen', 'full_name' => 'ALICE BENEFICIARY', 'national_id' => '1815888801', 'phone' => '0558888001', 'category_id' => $category->id, 'city' => 'Riyadh', 'district' => 'IDOR', 'status' => 'active', 'family_members_count' => 0, 'working_members_count' => 0, 'non_working_children_count' => 0, 'father_status' => 'alive', 'mother_status' => 'alive', 'monthly_salary' => 0, 'housing_type' => 'own', 'social_security_amount' => 0, 'citizen_account_amount' => 0, 'created_by' => $admin->id]);
        $benY = Beneficiary::create(['beneficiary_type' => 'citizen', 'full_name' => 'BOB BENEFICIARY', 'national_id' => '1815888802', 'phone' => '0558888002', 'category_id' => $category->id, 'city' => 'Jeddah', 'district' => 'IDOR', 'status' => 'active', 'family_members_count' => 0, 'working_members_count' => 0, 'non_working_children_count' => 0, 'father_status' => 'alive', 'mother_status' => 'alive', 'monthly_salary' => 0, 'housing_type' => 'rent', 'social_security_amount' => 0, 'citizen_account_amount' => 0, 'created_by' => $admin->id]);
        $daily = DailyBeneficiary::create(['full_name' => 'BOB DAILY', 'national_id' => '2815888803', 'phone' => '0668888003', 'district' => 'IDOR', 'status' => 'active', 'created_by' => $admin->id]);
        $support1 = SupportDistribution::create(['recipient_type' => 'beneficiary', 'beneficiary_id' => $benX->id, 'recipient_name' => 'ALICE BENEFICIARY', 'fulfillment_method' => 'delivery', 'status' => 'ready', 'created_by' => $admin->id, 'driver_id' => null]);
        $support2 = SupportDistribution::create(['recipient_type' => 'beneficiary', 'beneficiary_id' => $benY->id, 'recipient_name' => 'BOB BENEFICIARY', 'fulfillment_method' => 'delivery', 'status' => 'ready', 'created_by' => $admin->id, 'driver_id' => null]);

        $alice = $this->user('idor_alice', 'assistant_admin', ['beneficiaries' => ['view' => true, 'create' => true, 'edit' => true, 'notifications' => true], 'daily_beneficiaries' => ['view' => true], 'notifications' => ['view' => true]]);
        $bob = $this->user('idor_bob', 'staff', ['beneficiaries' => ['view' => true], 'support' => ['view' => true, 'fulfill' => true], 'receiver' => ['view' => true]]);
        $this->user('idor_noperms', 'reception', ['beneficiaries' => ['view' => true]]);

        // Owner-scoped notifications.
        $noteA = Notification::create(['category' => 'system_event', 'event_type' => 'beneficiary_changed', 'title' => 'ALICE NOTE', 'recipient_type' => 'staff', 'recipient_id' => $alice->id, 'related_record_type' => Beneficiary::class, 'related_record_id' => $benX->id, 'message_body' => 'ALICE SECRET BODY']);
        $noteB = Notification::create(['category' => 'system_event', 'event_type' => 'beneficiary_changed', 'title' => 'BOB NOTE', 'recipient_type' => 'staff', 'recipient_id' => $bob->id, 'related_record_type' => Beneficiary::class, 'related_record_id' => $benY->id, 'message_body' => 'BOB SECRET BODY']);

        // Driver assignments scoped by token hash (driver A vs driver B).
        $dA = Driver::create(['full_name' => 'DRIVER A', 'phone' => '0551111111', 'vehicle_info' => 'A', 'is_active' => true]);
        $dB = Driver::create(['full_name' => 'DRIVER B', 'phone' => '0552222222', 'vehicle_info' => 'B', 'is_active' => true]);
        $support1->update(['driver_id' => $dA->id]);
        $support2->update(['driver_id' => $dB->id]);
        $tokenA = bin2hex(random_bytes(32));
        $tokenB = bin2hex(random_bytes(32));
        $a1 = DriverAssignment::create(['driver_id' => $dA->id, 'created_by' => $admin->id, 'token_hash' => hash('sha256', $tokenA), 'expires_at' => now()->addHour()]);
        $a1->tasks()->attach([$support1->id]);
        $a2 = DriverAssignment::create(['driver_id' => $dB->id, 'created_by' => $admin->id, 'token_hash' => hash('sha256', $tokenB), 'expires_at' => now()->addHour()]);
        $a2->tasks()->attach([$support2->id]);

        Staff::create(['name' => 'IDOR STAFF', 'national_id' => '1012888804', 'phone' => '0558888004', 'job_title' => 'متابعة', 'hire_date' => '2024-01-01', 'status' => 'active']);

        $this->admin = $admin;
        $this->alice = $alice;
        $this->bob = $bob;
        $this->benY = $benY;
        $this->support2 = $support2;
        $this->noteB = $noteB;
        $this->noteA = $noteA;
        $this->tokenA = $tokenA;
        $this->tokenB = $tokenB;
        $this->taskA = $support1->id;
        $this->taskB = $support2->id;
        $this->daily = $daily;
    }

    public function test_beneficiary_cross_owner_access_is_role_gated_not_owner_gated(): void
    {
        // No owner-enumeration policy exists for beneficiaries; the resource is
        // gated by role + module permissions. Verify both directions work and
        // that a role outside the beneficiary module's role list never receives
        // record data (the middleware role gate is the enforcement boundary).
        $guarded = $this->user('idor_secretary', 'warehouse', ['daily_beneficiaries' => ['view' => true]]);
        Sanctum::actingAs($this->alice);
        $resp = $this->getJson('/api/beneficiaries/'.$this->benY->id);
        $this->assertNotEquals(403, $resp->getStatusCode(), 'alice has beneficiary view perms; the record must be readable by role policy');
        $this->assertSame(200, $resp->getStatusCode());
        $this->assertStringContainsString('BOB BENEFICIARY', (string) $resp->getContent());

        Sanctum::actingAs($guarded);
        $resp = $this->getJson('/api/beneficiaries/'.$this->benY->id);
        $this->assertSame(403, $resp->getStatusCode());
        $this->assertStringNotContainsString('BOB BENEFICIARY', (string) $resp->getContent());
    }

    public function test_notification_cross_owner_read_does_not_leak(): void
    {
        Sanctum::actingAs($this->alice);
        $index = $this->getJson('/api/notifications');
        $index->assertOk();
        $ids = array_column($index->json('data') ?? [], 'id');
        $this->assertContains($this->noteA->id, $ids);
        $this->assertNotContains($this->noteB->id, $ids, 'bob notification id must not appear in alice list');
        $this->assertStringNotContainsString('BOB SECRET BODY', (string) $index->getContent());

        // Direct mark-as-read of another user's notification must be 404 (findOrFail is recipient-scoped).
        $resp = $this->postJson('/api/notifications/'.$this->noteB->id.'/mark-as-read');
        $this->assertSame(404, $resp->getStatusCode());
        $this->assertNull($this->noteB->fresh()->read_at, 'another user must not be able to mutate bob notification');

        // Unread count remains scoped.
        $unread = $this->getJson('/api/notifications/unread-count');
        $this->assertSame(1, $unread->json('unread_count'), 'alice only sees her own unread');
    }

    public function test_account_direct_url_is_admin_only_without_leakage(): void
    {
        Sanctum::actingAs($this->alice);
        $resp = $this->getJson('/api/users/'.$this->bob->id);
        $this->assertSame(403, $resp->getStatusCode());
        $this->assertStringNotContainsString('idor_bob', (string) $resp->getContent());

        $resp = $this->getJson('/api/users/00000000-0000-0000-0000-000000000000');
        $this->assertSame(403, $resp->getStatusCode());

        Sanctum::actingAs($this->admin);
        $this->getJson('/api/users/'.$this->bob->id)->assertOk();
    }

    public function test_driver_task_cross_assignment_is_refused(): void
    {
        // Driver B's token must not reveal or open driver A's task.
        $resp = $this->withHeader('X-Driver-Token', $this->tokenB)->getJson('/api/driver-access/tasks/'.$this->taskA);
        $this->assertSame(404, $resp->getStatusCode(), 'cross-driver task must be 404');
        $this->assertStringNotContainsString('ALICE BENEFICIARY', (string) $resp->getContent());

        $list = $this->withHeader('X-Driver-Token', $this->tokenB)->getJson('/api/driver-access');
        $list->assertOk();
        $taskIds = array_column($list->json('data.tasks', $list->json('data') ?? []), 'id');
        $this->assertNotContains($this->taskA, $taskIds, "driver B's task list must not include driver A's task");

        // Driver A's own task opens fine with A's token.
        $own = $this->withHeader('X-Driver-Token', $this->tokenA)->getJson('/api/driver-access/tasks/'.$this->taskA);
        $this->assertEquals(200, $own->getStatusCode());
        $this->assertStringContainsString('ALICE BENEFICIARY', (string) $own->getContent());

        // Missing/forged bearer on the public driver route remains 401.
        $this->flushHeaders();
        $this->getJson('/api/driver-access')->assertStatus(401);
    }

    public function test_support_receipt_verification_is_permission_gated(): void
    {
        // alice lacks support/fulfill permission: issue+verify must be 403 with no data body.
        Sanctum::actingAs($this->alice);
        $issue = $this->postJson('/api/support/distributions/'.$this->support2->id.'/receipt-code');
        $this->assertSame(403, $issue->getStatusCode());
        $this->assertStringNotContainsString('BOB BENEFICIARY', (string) $issue->getContent());
        $verify = $this->postJson('/api/support/distributions/'.$this->support2->id.'/verify', ['code' => '0000']);
        $this->assertSame(403, $verify->getStatusCode());

        // bob has fulfill permission; a wrong code is a business rejection, never a leak.
        Sanctum::actingAs($this->bob);
        $issued = $this->postJson('/api/support/distributions/'.$this->support2->id.'/receipt-code');
        $this->assertNotEquals(401, $issued->getStatusCode());
        $this->assertNotEquals(403, $issued->getStatusCode());
        $this->assertStringNotContainsString('BOB SECRET BODY', (string) $issued->getContent());
    }

    public function test_settings_and_staff_direct_url_are_permission_gated(): void
    {
        $noPerms = $this->user('idor_noperms2', 'reception', ['beneficiaries' => ['view' => true]]);
        Sanctum::actingAs($noPerms);
        $settings = $this->postJson('/api/settings', ['key' => 'x']); // no settings permission; update verb is POST /settings
        $this->assertSame(403, $settings->getStatusCode());

        $staffSelf = $this->user('idor_staffself', 'assistant_admin', ['staff' => ['view' => true]]);
        Sanctum::actingAs($staffSelf);
        $resp = $this->getJson('/api/staff/999999');
        $this->assertNotEquals(200, $resp->getStatusCode(), 'must not return the seeded staff record for a bogus id without leak');
        $this->assertStringNotContainsString('IDOR STAFF', (string) $resp->getContent());

        $noStaff = $this->user('idor_nostaff', 'reception', []);
        Sanctum::actingAs($noStaff);
        $resp = $this->getJson('/api/neighborhood-reps');
        $this->assertSame(403, $resp->getStatusCode());
    }

    public function test_guest_direct_protected_urls_are_401(): void
    {
        foreach (['/api/beneficiaries', '/api/notifications', '/api/audit', '/api/users', '/api/support/distributions', '/api/daily-beneficiaries/'.$this->daily->id] as $url) {
            $this->getJson($url)->assertStatus(401);
        }
    }
}
