<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class RepresentativeDriverOptionsTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $role, array $permissions = [], bool $active = true): User
    {
        return User::create(['username' => 'TEST_'.Str::random(12), 'full_name' => 'TEST '.$role, 'password' => 'Local-Test-Only!123', 'role' => $role, 'permissions' => $permissions, 'is_active' => $active, 'email' => Str::random(8).'@example.invalid', 'phone' => '0500000000']);
    }

    public function test_representative_viewer_gets_only_active_drivers_and_minimum_fields(): void
    {
        $actor = $this->user('assistant_admin', ['representatives' => ['view' => true], 'delivery' => ['view' => false], 'support' => ['view' => false]]);
        $a = $this->user('driver');
        $b = $this->user('delivery_driver');
        $this->user('driver', [], false);
        $this->user('staff');
        Sanctum::actingAs($actor);
        $response = $this->getJson('/api/neighborhood-reps/driver-options')->assertOk()->assertJsonCount(2, 'data');
        $this->assertEqualsCanonicalizing([$a->id, $b->id], array_column($response->json('data'), 'id'));
        foreach ($response->json('data') as $row) {
            $this->assertEqualsCanonicalizing(['id', 'full_name', 'role', 'is_active'], array_keys($row));
        }
        $this->getJson('/api/users')->assertForbidden();
        $this->getJson('/api/support/distributions')->assertForbidden();
    }

    public function test_admin_control_is_allowed(): void
    {
        Sanctum::actingAs($this->user('admin'));
        $this->getJson('/api/neighborhood-reps/driver-options')->assertOk();
    }

    public function test_denied_representative_grant_is_not_overridden_by_delivery_grant(): void
    {
        Sanctum::actingAs($this->user('assistant_admin', ['representatives' => ['view' => false], 'delivery' => ['view' => true]]));
        $this->getJson('/api/neighborhood-reps/driver-options')->assertForbidden();
    }

    public function test_disallowed_role_cannot_read_directory(): void
    {
        Sanctum::actingAs($this->user('reception', ['representatives' => ['view' => true]]));
        $this->getJson('/api/neighborhood-reps/driver-options')->assertForbidden();
    }

    public function test_guest_cannot_read_directory(): void
    {
        $this->getJson('/api/neighborhood-reps/driver-options')->assertUnauthorized();
    }

    public function test_inactive_viewer_cannot_read_directory(): void
    {
        Sanctum::actingAs($this->user('assistant_admin', ['representatives' => ['view' => true]], false));
        $this->getJson('/api/neighborhood-reps/driver-options')->assertUnauthorized();
    }
}
