<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PasswordChangeContractTest extends TestCase
{
    use RefreshDatabase;

    private const OLD_PASSWORD = 'TEST-Old!Password123';

    private const NEW_PASSWORD = 'TEST-New!Password456';

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        User::create(['username' => 'TEST_ADMIN', 'full_name' => 'TEST Admin', 'password' => self::OLD_PASSWORD, 'role' => 'admin', 'is_active' => true]);
        $this->user = User::create(['username' => 'TEST_STAFF', 'full_name' => 'TEST Staff', 'password' => self::OLD_PASSWORD, 'role' => 'staff', 'is_active' => true]);
        $this->user->forceFill(['must_change_password' => true, 'temporary_password_expires_at' => now()->addHour()])->save();
    }

    private function payload(array $overrides = []): array
    {
        return array_replace(['current_password' => self::OLD_PASSWORD, 'password' => self::NEW_PASSWORD, 'password_confirmation' => self::NEW_PASSWORD], $overrides);
    }

    public function test_valid_change_clears_temporary_state_revokes_tokens_and_audits_without_secrets(): void
    {
        $token = $this->user->createToken('current')->plainTextToken;
        $this->user->createToken('other-device');
        $this->withToken($token)->postJson('/api/change-password', $this->payload())->assertOk();
        $user = $this->user->fresh();
        $this->assertTrue(Hash::check(self::NEW_PASSWORD, $user->password));
        $this->assertNotSame(self::NEW_PASSWORD, $user->password);
        $this->assertFalse($user->must_change_password);
        $this->assertNull($user->temporary_password_expires_at);
        $this->assertSame(0, $user->tokens()->count());
        $audit = AuditLog::where('action', 'PASSWORD_CHANGED')->sole();
        $this->assertSame($user->id, $audit->user_id);
        $this->assertSame($user->id, $audit->target_id);
        $this->assertSame([], $audit->details);
    }

    public function test_wrong_current_password_does_not_change_state(): void
    {
        Sanctum::actingAs($this->user);
        $this->postJson('/api/change-password', $this->payload(['current_password' => 'TEST-Wrong!Password123']))->assertUnprocessable();
        $this->assertUnchanged();
    }

    public function test_weak_new_password_is_rejected(): void
    {
        Sanctum::actingAs($this->user);
        $this->postJson('/api/change-password', $this->payload(['password' => 'weak', 'password_confirmation' => 'weak']))->assertUnprocessable()->assertJsonValidationErrors('password');
        $this->assertUnchanged();
    }

    public function test_mismatched_confirmation_is_rejected(): void
    {
        Sanctum::actingAs($this->user);
        $this->postJson('/api/change-password', $this->payload(['password_confirmation' => 'TEST-Different!Password789']))->assertUnprocessable()->assertJsonValidationErrors('password');
        $this->assertUnchanged();
    }

    public function test_guest_cannot_change_password(): void
    {
        $this->postJson('/api/change-password', $this->payload())->assertUnauthorized();
        $this->assertUnchanged();
    }

    public function test_supplied_other_user_identifiers_cannot_change_that_users_password(): void
    {
        $other = User::where('username', 'TEST_ADMIN')->firstOrFail();
        $otherHash = $other->password;
        Sanctum::actingAs($this->user);
        $this->postJson('/api/change-password', $this->payload(['user_id' => $other->id, 'id' => $other->id, 'username' => $other->username]))->assertOk();
        $this->assertSame($otherHash, $other->fresh()->password);
        $this->assertTrue(Hash::check(self::NEW_PASSWORD, $this->user->fresh()->password));
        $this->assertSame($this->user->id, AuditLog::where('action', 'PASSWORD_CHANGED')->sole()->target_id);
    }

    public function test_old_password_cannot_log_in_after_success(): void
    {
        $this->changeWithRealToken();
        $this->postJson('/api/login', ['username' => $this->user->username, 'password' => self::OLD_PASSWORD])->assertUnprocessable();
    }

    public function test_new_password_can_log_in_after_success(): void
    {
        $this->changeWithRealToken();
        $this->postJson('/api/login', ['username' => $this->user->username, 'password' => self::NEW_PASSWORD])->assertOk()->assertJsonPath('data.user.must_change_password', false);
    }

    public function test_expired_temporary_password_is_rejected(): void
    {
        $this->user->forceFill(['temporary_password_expires_at' => now()->subMinute()])->save();
        Sanctum::actingAs($this->user);
        $this->postJson('/api/change-password', $this->payload())->assertUnprocessable();
        $this->assertUnchanged();
    }

    public function test_inactive_account_is_rejected(): void
    {
        $this->user->forceFill(['is_active' => false])->save();
        Sanctum::actingAs($this->user);
        $this->postJson('/api/change-password', $this->payload())->assertUnauthorized();
        $this->assertUnchanged();
    }

    private function changeWithRealToken(): void
    {
        $token = $this->user->createToken('current')->plainTextToken;
        $this->withToken($token)->postJson('/api/change-password', $this->payload())->assertOk();
        $this->app['auth']->forgetGuards();
        $this->flushHeaders();
    }

    private function assertUnchanged(): void
    {
        $this->assertTrue(Hash::check(self::OLD_PASSWORD, $this->user->fresh()->password));
        $this->assertTrue($this->user->fresh()->must_change_password);
        $this->assertSame(0, AuditLog::where('action', 'PASSWORD_CHANGED')->count());
    }
}
