<?php

namespace Tests\Feature;

use Tests\TestCase;
use Illuminate\Foundation\Testing\RefreshDatabase;
use App\Models\User;

class AuthenticationFailureTest extends TestCase
{
    use RefreshDatabase;

    /** @test */
    public function it_fails_when_user_not_found()
    {
        $response = $this->postJson('/api/login', [
            'username' => 'nonexistent',
            'password' => 'secret',
        ]);
        $response->assertStatus(401);
        $response->assertJsonMissing(['token']);
    }

    /** @test */
    public function it_fails_with_wrong_password()
    {
        $user = User::factory()->create([
            'username' => 'john',
            'password' => bcrypt('correct'),
        ]);
        $response = $this->postJson('/api/login', [
            'username' => 'john',
            'password' => 'wrong',
        ]);
        $response->assertStatus(401);
    }

    /** @test */
    public function it_fails_when_user_is_inactive()
    {
        $user = User::factory()->create([
            'username' => 'jane',
            'password' => bcrypt('secret'),
            'is_active' => false,
        ]);
        $response = $this->postJson('/api/login', [
            'username' => 'jane',
            'password' => 'secret',
        ]);
        $response->assertStatus(401);
    }
}
?>
