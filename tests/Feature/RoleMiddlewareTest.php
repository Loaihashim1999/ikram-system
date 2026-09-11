<?php

namespace Tests\Feature;

use Tests\TestCase;
use Illuminate\Foundation\Testing\RefreshDatabase;
use App\Models\User;
use Laravel\Sanctum\Sanctum;

class RoleMiddlewareTest extends TestCase
{
    use RefreshDatabase;

    public function test_non_admin_cannot_access_admin_route(): void
    {
        \Illuminate\Support\Facades\Route::get('/api/admin/secure-endpoint', function () {
            return response()->json(['secret' => 'data']);
        })->middleware(['auth:sanctum', 'role:admin']);

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
