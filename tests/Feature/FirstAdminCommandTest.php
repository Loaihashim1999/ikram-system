<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class FirstAdminCommandTest extends TestCase
{
    use RefreshDatabase;

    private function setupCommand(string $password, string $confirmation)
    {
        return $this->artisan('app:ensure-production-admin')
            ->expectsQuestion('Full name', 'Test Operator')
            ->expectsQuestion('Username', 'Test_Operator')
            ->expectsQuestion('Email', 'Operator@example.test')
            ->expectsQuestion('Password', $password)
            ->expectsQuestion('Confirm password', $confirmation);
    }

    public function test_interactive_setup_hashes_password_and_grants_existing_admin_permissions(): void
    {
        $password = bin2hex(random_bytes(16)).'!aA1';
        $this->setupCommand($password, $password)
            ->expectsConfirmation('Create the first administrator and permanently close setup?', 'yes')
            ->assertSuccessful();
        $admin = User::query()->sole();
        $this->assertSame('admin', $admin->role);
        $this->assertSame([], $admin->permissions);
        $this->assertTrue($admin->hasPermission('users.manage'));
        $this->assertSame('test_operator', $admin->username);
        $this->assertTrue(Hash::check($password, $admin->password));
        $this->assertStringStartsWith('$argon2id$', $admin->password);
        $this->assertNotNull(DB::table('system_initializations')->where('key', 'first_admin')->value('completed_at'));
        $this->assertDatabaseHas('audit_logs', ['action' => 'FIRST_ADMIN_INITIALIZED', 'target_id' => $admin->id]);
        $this->artisan('app:ensure-production-admin')->assertSuccessful();
        $this->assertDatabaseCount('users', 1);
    }

    public function test_invalid_password_creates_nothing(): void
    {
        $this->setupCommand('weak', 'different')->assertFailed();
        $this->assertDatabaseCount('users', 0);
        $this->assertNull(DB::table('system_initializations')->where('key', 'first_admin')->value('completed_at'));
    }

    public function test_cancelled_setup_creates_nothing(): void
    {
        $password = bin2hex(random_bytes(16)).'!aA1';
        $this->setupCommand($password, $password)
            ->expectsConfirmation('Create the first administrator and permanently close setup?', 'no')
            ->assertFailed();
        $this->assertDatabaseCount('users', 0);
        $this->assertNull(DB::table('system_initializations')->where('key', 'first_admin')->value('completed_at'));
    }

    public function test_completed_setup_cannot_be_reopened_without_an_admin(): void
    {
        DB::table('system_initializations')->where('key', 'first_admin')->update(['completed_at' => now()]);
        $password = bin2hex(random_bytes(16)).'!aA1';
        $this->setupCommand($password, $password)
            ->expectsConfirmation('Create the first administrator and permanently close setup?', 'yes')
            ->assertFailed();
        $this->assertDatabaseCount('users', 0);
        $this->assertDatabaseMissing('audit_logs', ['action' => 'FIRST_ADMIN_INITIALIZED']);
    }

    public function test_noninteractive_setup_is_refused(): void
    {
        $this->artisan('app:ensure-production-admin', ['--no-interaction' => true])->assertFailed();
        $this->assertDatabaseCount('users', 0);
    }

    public function test_production_http_setup_is_refused(): void
    {
        $this->app->instance('env', 'production');
        $this->postJson('/api/setup-admin', [])->assertForbidden();
        $this->assertDatabaseCount('users', 0);
    }
}
