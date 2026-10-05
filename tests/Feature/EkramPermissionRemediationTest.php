<?php

namespace Tests\Feature;

use App\Models\Driver;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class EkramPermissionRemediationTest extends TestCase
{
    use RefreshDatabase;

    public function test_readonly_cannot_mutate_support_even_with_stale_mutation_grants(): void
    {
        $user = User::create(['username' => 'EKRAM-E2E-TEST-readonly', 'full_name' => 'EKRAM-E2E-TEST readonly', 'password' => Str::random(32), 'role' => 'readonly', 'is_active' => true,
            'permissions' => ['support' => ['view' => true, 'create' => true, 'edit' => true, 'approve' => true, 'fulfill' => true, 'cancel' => true]]]);
        Sanctum::actingAs($user);
        $this->getJson('/api/support/distributions')->assertOk();
        $this->postJson('/api/support/distributions', [])->assertForbidden();
        $this->patchJson('/api/support/distributions/'.Str::uuid().'/approve', [])->assertForbidden();
        $this->patchJson('/api/support/distributions/'.Str::uuid(), [])->assertForbidden();
    }

    public function test_export_requires_its_own_grant_and_view(): void
    {
        $viewer = User::create(['username' => 'EKRAM-E2E-TEST-'.Str::random(8), 'full_name' => 'EKRAM-E2E-TEST viewer', 'password' => Str::random(32), 'role' => 'staff', 'is_active' => true, 'permissions' => ['support' => ['view' => true, 'export' => false]]]);
        Sanctum::actingAs($viewer);
        $this->getJson('/api/support/distributions')->assertOk();
        $this->getJson('/api/support/distributions?all=true&per_page=-1')->assertForbidden();
        $this->getJson('/api/support/distributions?all=true')->assertForbidden();
        $viewer->update(['permissions' => ['support' => ['view' => true, 'export' => true]]]);
        $this->getJson('/api/support/distributions?all=true&per_page=-1')->assertOk();
        $viewer->update(['permissions' => ['support' => ['view' => false, 'export' => true]]]);
        $this->getJson('/api/support/distributions?all=true&per_page=-1')->assertForbidden();
    }

    public function test_driver_accounts_are_deprecated_without_destroying_legacy_accounts(): void
    {
        $admin = User::create(['username' => 'EKRAM-E2E-TEST-admin', 'full_name' => 'EKRAM-E2E-TEST admin', 'password' => Str::random(32), 'role' => 'admin', 'is_active' => true]);
        Sanctum::actingAs($admin);
        foreach (['driver', 'delivery_driver'] as $role) {
            $this->postJson('/api/users', ['username' => 'EKRAM-E2E-TEST-new-'.$role, 'full_name' => 'EKRAM-E2E-TEST driver', 'password' => Str::random(32), 'role' => $role])->assertUnprocessable()->assertJsonValidationErrors('role');
            $this->assertDatabaseMissing('users', ['username' => 'EKRAM-E2E-TEST-new-'.$role]);
            $legacy = User::create(['username' => 'EKRAM-E2E-TEST-legacy-'.$role, 'full_name' => 'EKRAM-E2E-TEST legacy', 'password' => Str::random(32), 'role' => $role, 'is_active' => true]);
            $this->putJson('/api/users/'.$legacy->id, ['role' => $role, 'full_name' => 'EKRAM-E2E-TEST retained'])->assertOk();
            $this->assertDatabaseHas('users', ['id' => $legacy->id, 'role' => $role]);
        }
        $dedicated = Driver::create(['full_name' => 'EKRAM-E2E-TEST Driver', 'phone' => '0501234599', 'is_active' => true]);
        $this->assertDatabaseMissing('users', ['id' => $dedicated->id]);
        $this->assertDatabaseMissing('users', ['phone' => '0501234599']);
        $this->assertNotSame($dedicated->id, User::where('role', 'delivery_driver')->value('id'));
    }
}
