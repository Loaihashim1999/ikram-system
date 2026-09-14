<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class EnsureProductionAdminTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_creates_the_configured_admin_when_none_exists(): void
    {
        config()->set('ikram.bootstrap_admin', [
            'username' => 'release-admin',
            'password' => 'a-strong-bootstrap-password',
            'email' => 'release-admin@example.test',
            'full_name' => 'Release Administrator',
        ]);

        $this->artisan('app:ensure-production-admin')->assertSuccessful();

        $admin = User::query()->where('username', 'release-admin')->firstOrFail();
        $this->assertSame('admin', $admin->role);
        $this->assertTrue($admin->is_active);
        $this->assertTrue(Hash::check('a-strong-bootstrap-password', $admin->password));
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

    public function test_it_skips_creation_when_no_password_is_configured(): void
    {
        config()->set('ikram.bootstrap_admin.password');

        $this->artisan('app:ensure-production-admin')->assertSuccessful();

        $this->assertDatabaseCount('users', 0);
    }
}
