<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class FirstAdminSetupTest extends TestCase
{
    use RefreshDatabase;

    private array $validPayload = [
        'full_name' => 'مدير إكرام الرئيسي',
        'username' => 'primary_admin',
        'email' => 'primary.admin@example.test',
        'password' => 'Strong!Admin123',
        'password_confirmation' => 'Strong!Admin123',
    ];

    public function test_fresh_database_requires_setup_and_blocks_login(): void
    {
        $this->getJson('/api/setup-admin/status')
            ->assertOk()
            ->assertJsonPath('data.setup_required', true);

        $this->postJson('/api/login', ['username' => 'admin', 'password' => 'anything'])
            ->assertStatus(409)
            ->assertJsonPath('code', 'SETUP_REQUIRED');
    }

    public function test_first_admin_is_created_with_a_secure_hash_and_audit_event(): void
    {
        $this->postJson('/api/setup-admin', $this->validPayload)->assertCreated();

        $admin = User::query()->sole();
        $this->assertSame('admin', $admin->role);
        $this->assertSame('primary.admin@example.test', $admin->email);
        $this->assertNotSame($this->validPayload['password'], $admin->password);
        $this->assertStringStartsWith('$argon2id$', $admin->password);
        $this->assertTrue(Hash::check($this->validPayload['password'], $admin->password));
        $this->assertFalse(Hash::check('Wrong!Password123', $admin->password));
        $this->assertNotNull(DB::table('system_initializations')->where('key', 'first_admin')->value('completed_at'));
        $this->assertDatabaseHas('audit_logs', ['action' => 'FIRST_ADMIN_INITIALIZED', 'target_id' => $admin->id]);
    }

    public function test_setup_is_permanently_closed_after_creation_and_login_works(): void
    {
        $this->postJson('/api/setup-admin', $this->validPayload)->assertCreated();

        $this->getJson('/api/setup-admin/status')->assertJsonPath('data.setup_required', false);
        $this->postJson('/api/setup-admin', [
            ...$this->validPayload,
            'username' => 'second_admin',
            'email' => 'second@example.test',
        ])->assertForbidden();
        $this->assertDatabaseCount('users', 1);

        $this->postJson('/api/login', [
            'username' => 'primary_admin',
            'password' => 'Strong!Admin123',
        ])->assertOk()->assertJsonPath('data.user.role', 'admin');
    }

    public function test_backend_rejects_weak_or_unconfirmed_passwords(): void
    {
        $this->postJson('/api/setup-admin', [
            ...$this->validPayload,
            'password' => 'weak',
            'password_confirmation' => 'different',
        ])->assertUnprocessable()->assertJsonValidationErrors('password');

        $this->assertDatabaseCount('users', 0);
    }

    public function test_existing_admin_disables_setup_even_if_initialization_flag_is_unset(): void
    {
        User::factory()->create(['role' => 'admin', 'is_active' => true]);

        $this->getJson('/api/setup-admin/status')->assertJsonPath('data.setup_required', false);
        $this->postJson('/api/setup-admin', $this->validPayload)->assertForbidden();
        $this->assertDatabaseCount('users', 1);
    }
}
