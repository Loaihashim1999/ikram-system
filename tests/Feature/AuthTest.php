<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_login_with_valid_credentials(): void
    {
        $user = User::create([
            'username' => 'admin_user',
            'full_name' => 'مدير النظام',
            'password' => Hash::make('secret123'),
            'role' => 'admin',
            'is_active' => true,
        ]);

        $response = $this->postJson('/api/login', [
            'username' => 'admin_user',
            'password' => 'secret123',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'تم تسجيل الدخول بنجاح',
            ])
            ->assertJsonStructure([
                'data' => [
                    'user' => ['id', 'username', 'full_name', 'role'],
                    'token',
                ],
            ]);
    }

    public function test_login_fails_with_invalid_credentials(): void
    {
        User::create([
            'username' => 'test_user',
            'full_name' => 'مستخدم تجريبي',
            'password' => Hash::make('secret123'),
            'role' => 'staff',
            'is_active' => true,
        ]);

        $response = $this->postJson('/api/login', [
            'username' => 'test_user',
            'password' => 'wrongpassword',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['username']);
    }

    public function test_login_fails_for_inactive_user(): void
    {
        User::create([
            'username' => 'disabled_user',
            'full_name' => 'حساب معطل',
            'password' => Hash::make('secret123'),
            'role' => 'staff',
            'is_active' => false,
        ]);

        $response = $this->postJson('/api/login', [
            'username' => 'disabled_user',
            'password' => 'secret123',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['username']);
    }

    public function test_authenticated_user_can_fetch_me(): void
    {
        $user = User::create([
            'username' => 'active_user',
            'full_name' => 'مستخدم نشط',
            'password' => Hash::make('secret123'),
            'role' => 'admin',
            'is_active' => true,
        ]);

        Sanctum::actingAs($user);

        $response = $this->getJson('/api/me');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'id' => $user->id,
                    'username' => 'active_user',
                ],
            ]);
    }

    public function test_unauthenticated_user_cannot_access_protected_routes(): void
    {
        $response = $this->getJson('/api/me');

        $response->assertStatus(401);
    }

    public function test_authenticated_user_can_logout(): void
    {
        $user = User::create([
            'username' => 'logout_user',
            'full_name' => 'مستخدم خروج',
            'password' => Hash::make('secret123'),
            'role' => 'admin',
            'is_active' => true,
        ]);

        Sanctum::actingAs($user);

        $response = $this->postJson('/api/logout');

        $response->assertStatus(200)
            ->assertJson(['success' => true]);
    }
}
