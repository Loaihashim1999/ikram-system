<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AuthenticationFailureTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        User::factory()->create(['role' => 'admin', 'is_active' => true]);
    }

    public function test_it_fails_when_user_not_found(): void
    {
        $response = $this->postJson('/api/login', [
            'username' => 'nonexistent',
            'password' => 'secret',
        ]);
        $response->assertStatus(422);
        $response->assertJsonMissing(['token']);
    }

    public function test_it_fails_with_wrong_password(): void
    {
        $user = User::factory()->create([
            'username' => 'john',
            'password' => Hash::make('correct'),
        ]);
        $response = $this->postJson('/api/login', [
            'username' => 'john',
            'password' => 'wrong',
        ]);
        $response->assertStatus(422);
    }

    public function test_it_fails_when_user_is_inactive(): void
    {
        $user = User::factory()->create([
            'username' => 'jane',
            'password' => Hash::make('secret'),
            'is_active' => false,
        ]);
        $response = $this->postJson('/api/login', [
            'username' => 'jane',
            'password' => 'secret',
        ]);
        $response->assertStatus(422);
    }

    public function test_normal_user_locks_after_three_failed_attempts(): void
    {
        $user = User::factory()->create([
            'username' => 'locked_user',
            'password' => Hash::make('correct-password'),
            'role' => 'staff',
            'is_active' => true,
        ]);

        for ($attempt = 0; $attempt < 3; $attempt++) {
            $this->postJson('/api/login', ['username' => 'locked_user', 'password' => 'wrong'])->assertUnprocessable();
        }

        $this->assertTrue((bool) $user->fresh()->is_locked);
        $this->postJson('/api/login', ['username' => 'locked_user', 'password' => 'correct-password'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('username');
    }
}
