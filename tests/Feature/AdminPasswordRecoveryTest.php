<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class AdminPasswordRecoveryTest extends TestCase
{
    use RefreshDatabase;

    public function test_recovery_is_unavailable_before_first_admin_setup(): void
    {
        $this->postJson('/api/forgot-password', ['email' => 'admin@example.test'])->assertStatus(409);
        $this->postJson('/api/reset-password', [])->assertStatus(409);
    }

    public function test_registered_admin_can_reset_password_and_existing_tokens_are_revoked(): void
    {
        Notification::fake();
        $admin = User::factory()->create([
            'role' => 'admin',
            'email' => 'admin@example.test',
            'password' => 'Old!Password123',
        ]);
        $admin->createToken('existing-session');

        $this->postJson('/api/forgot-password', ['email' => 'ADMIN@example.test'])->assertOk();

        $token = null;
        Notification::assertSentTo($admin, ResetPassword::class, function (ResetPassword $notification) use (&$token) {
            $token = $notification->token;

            return true;
        });

        $this->postJson('/api/reset-password', [
            'token' => $token,
            'email' => 'admin@example.test',
            'password' => 'New!Password456',
            'password_confirmation' => 'New!Password456',
        ])->assertOk();

        $this->assertTrue(Hash::check('New!Password456', $admin->fresh()->password));
        $this->assertDatabaseCount('personal_access_tokens', 0);
        $this->postJson('/api/login', ['username' => $admin->username, 'password' => 'New!Password456'])->assertOk();
    }

    public function test_unknown_email_receives_generic_response_without_notification(): void
    {
        Notification::fake();
        User::factory()->create(['role' => 'admin', 'email' => 'admin@example.test']);

        $this->postJson('/api/forgot-password', ['email' => 'unknown@example.test'])
            ->assertOk()
            ->assertJsonPath('message', 'إذا كان البريد مسجلاً فسيصلك رابط استعادة آمن.');

        Notification::assertNothingSent();
    }
}
