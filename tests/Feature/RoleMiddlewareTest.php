<?php

namespace Tests\Feature;

use Tests\TestCase;
use Illuminate\Foundation\Testing\RefreshDatabase;
use App\Models\User;
use Laravel\Sanctum\Sanctum;

class RoleMiddlewareTest extends TestCase
{
    use RefreshDatabase;

    /** @test */
    public function non_admin_cannot_access_admin_route()
    {
        $user = User::factory()->create([
            'role' => 'staff',
            'is_active' => true,
        ]);
        Sanctum::actingAs($user);
        $response = $this->getJson('/api/admin/secure-endpoint');
        $response->assertStatus(403);
    }
}
?>
