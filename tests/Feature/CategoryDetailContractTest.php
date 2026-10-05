<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CategoryDetailContractTest extends TestCase
{
    use RefreshDatabase;

    public function test_category_details_are_scoped_and_authorized_by_current_policy(): void
    {
        $target = Category::create([
            'name' => 'Synthetic category target',
            'description' => 'Target description',
            'basket_entitlement_per_period' => 3,
        ]);
        $other = Category::create([
            'name' => 'Synthetic unrelated category',
            'description' => 'Unrelated description',
            'basket_entitlement_per_period' => 8,
        ]);
        $before = Category::count();

        foreach (['admin', 'assistant_admin', 'reception', 'staff', 'readonly'] as $role) {
            Sanctum::actingAs($this->actor($role));
            $response = $this->getJson('/api/categories/'.$target->id);

            $response->assertOk()
                ->assertJsonPath('success', true)
                ->assertJsonPath('data.id', $target->id)
                ->assertJsonPath('data.name', 'Synthetic category target')
                ->assertJsonPath('data.description', 'Target description')
                ->assertJsonPath('data.basket_entitlement_per_period', 3)
                ->assertJsonPath('data.beneficiaries_count', 0);
            $this->assertSame($before, Category::count());
            $this->assertDatabaseHas('categories', ['id' => $other->id, 'name' => 'Synthetic unrelated category']);
            $this->assertStringNotContainsString($other->id, $response->getContent());
        }

        foreach (['warehouse', 'driver', 'delivery_driver'] as $role) {
            Sanctum::actingAs($this->actor($role));
            $this->getJson('/api/categories/'.$target->id)->assertForbidden();
            $this->assertSame($before, Category::count());
            $this->assertDatabaseHas('categories', ['id' => $target->id]);
        }

        Sanctum::actingAs($this->actor('admin'));
        $this->getJson('/api/categories/'.'00000000-0000-4000-8000-000000000000')->assertNotFound();
        $this->assertSame($before, Category::count());
    }

    private function actor(string $role): User
    {
        static $sequence = 0;
        $sequence++;

        return User::create([
            'username' => 'CAT_DETAIL_'.$sequence,
            'full_name' => 'Synthetic category reviewer',
            'email' => 'cat-detail-'.$sequence.'@example.invalid',
            'password' => 'Synthetic-password-123!',
            'role' => $role,
            'permissions' => ['beneficiaries' => ['view' => true]],
            'is_active' => true,
        ]);
    }
}
