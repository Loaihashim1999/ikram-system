<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use RuntimeException;
use Tests\TestCase;

class UserAccountAuditAtomicityTest extends TestCase
{
    use RefreshDatabase;

    public function test_account_creation_rolls_back_when_audit_write_fails(): void
    {
        Sanctum::actingAs($this->admin());
        $this->failAuditWrites();

        try {
            $this->postJson('/api/users', [
                'username' => 'TEST_AUDIT_NEW', 'password' => 'Temporary123!',
                'full_name' => 'TEST AUDIT NEW', 'role' => 'readonly',
            ])->assertStatus(500);
            $this->assertDatabaseMissing('users', ['username' => 'TEST_AUDIT_NEW']);
        } finally {
            AuditLog::flushEventListeners();
        }
    }

    public function test_permission_update_rolls_back_when_audit_write_fails(): void
    {
        Sanctum::actingAs($this->admin());
        $target = User::create([
            'username' => 'TEST_AUDIT_TARGET', 'full_name' => 'TEST AUDIT TARGET',
            'password' => 'Temporary123!', 'role' => 'readonly', 'is_active' => true,
        ]);
        $this->failAuditWrites();

        try {
            $this->putJson('/api/users/'.$target->id, [
                'role' => 'staff', 'permissions' => ['beneficiaries' => ['view' => true]],
            ])->assertStatus(500);
            $this->assertDatabaseHas('users', ['id' => $target->id, 'role' => 'readonly']);
            $this->assertSame([], $target->fresh()->permissions ?? []);
        } finally {
            AuditLog::flushEventListeners();
        }
    }

    public function test_notification_permission_update_rolls_back_when_audit_write_fails(): void
    {
        Sanctum::actingAs($this->admin());
        $target = User::create([
            'username' => 'TEST_AUDIT_NOTIFY', 'full_name' => 'TEST AUDIT NOTIFY',
            'password' => 'Temporary123!', 'role' => 'staff', 'is_active' => true,
            'can_receive_notifications' => false,
        ]);
        $this->failAuditWrites();

        try {
            $this->postJson('/api/users/'.$target->id.'/toggle-notifications', [
                'can_receive_notifications' => true,
            ])->assertStatus(500);
            $this->assertFalse($target->fresh()->canReceiveNotifications());
        } finally {
            AuditLog::flushEventListeners();
        }
    }

    public function test_account_changes_create_sanitized_audit_events_with_targets(): void
    {
        $actor = $this->admin();
        Sanctum::actingAs($actor);
        $created = $this->postJson('/api/users', [
            'username' => 'TEST_AUDIT_SUCCESS', 'password' => 'Temporary123!',
            'full_name' => 'TEST AUDIT SUCCESS', 'role' => 'readonly',
        ])->assertCreated();
        $id = $created->json('data.id');
        $this->putJson('/api/users/'.$id, ['role' => 'staff'])->assertOk();
        $this->postJson('/api/users/'.$id.'/toggle-notifications', [
            'can_receive_notifications' => false,
        ])->assertOk();

        foreach (['CREATE_USER_ACCOUNT', 'UPDATE_USER_ACCOUNT', 'TOGGLE_NOTIFICATIONS'] as $action) {
            $entry = AuditLog::where('action', $action)->where('target_table', 'users')->where('target_id', $id)->firstOrFail();
            $this->assertSame($actor->id, $entry->user_id);
            $this->assertStringNotContainsString('Temporary123!', json_encode($entry->details));
        }
    }

    private function admin(): User
    {
        return User::create([
            'username' => 'TEST_AUDIT_ADMIN', 'full_name' => 'TEST AUDIT ADMIN',
            'password' => 'Temporary123!', 'role' => 'admin', 'is_active' => true,
        ]);
    }

    private function failAuditWrites(): void
    {
        AuditLog::creating(function (): void {
            throw new RuntimeException('Simulated audit write failure');
        });
    }
}
