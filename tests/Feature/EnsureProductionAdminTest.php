<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class EnsureProductionAdminTest extends TestCase
{
    use RefreshDatabase;

    public function test_noninteractive_setup_does_not_use_legacy_configured_credentials(): void
    {
        config()->set('ikram.bootstrap_admin', [
            'username' => 'release-admin',
            'password' => 'LegacyConfigured!aA12345',
            'email' => 'release-admin@example.test',
            'full_name' => 'Release Administrator',
        ]);

        $this->artisan('app:ensure-production-admin', ['--no-interaction' => true])
            ->expectsOutput('First administrator setup requires an interactive operator session.')
            ->assertFailed();

        $this->assertDatabaseCount('users', 0);
        $this->assertDatabaseHas('system_initializations', ['key' => 'first_admin', 'completed_at' => null]);
        $this->assertDatabaseMissing('audit_logs', ['action' => 'FIRST_ADMIN_INITIALIZED']);
    }

    public function test_it_never_changes_an_existing_admin(): void
    {
        $admin = User::factory()->create([
            'username' => 'existing-admin',
            'password' => 'existing-password',
            'role' => 'admin',
        ]);

        config()->set('ikram.bootstrap_admin.password', 'replacement-password');

        $this->artisan('app:ensure-production-admin')->assertSuccessful();

        $this->assertTrue(Hash::check('existing-password', $admin->fresh()->password));
        $this->assertDatabaseCount('users', 1);
    }

    public function test_noninteractive_setup_without_a_configured_password_is_refused(): void
    {
        config()->set('ikram.bootstrap_admin.password');

        $this->artisan('app:ensure-production-admin', ['--no-interaction' => true])
            ->expectsOutput('First administrator setup requires an interactive operator session.')
            ->assertFailed();

        $this->assertDatabaseCount('users', 0);
        $this->assertDatabaseHas('system_initializations', ['key' => 'first_admin', 'completed_at' => null]);
        $this->assertDatabaseMissing('audit_logs', ['action' => 'FIRST_ADMIN_INITIALIZED']);
    }
}
