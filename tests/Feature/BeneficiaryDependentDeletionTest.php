<?php

namespace Tests\Feature;

use App\Models\Beneficiary;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Support\PolicyEScenario;
use Tests\TestCase;

class BeneficiaryDependentDeletionTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Queue::fake();
    }

    public static function permittedRoles(): array
    {
        return array_combine(
            ['admin', 'assistant_admin', 'reception', 'staff'],
            array_map(fn ($role) => [$role], ['admin', 'assistant_admin', 'reception', 'staff']),
        );
    }

    public static function forbiddenRoles(): array
    {
        return array_combine(
            ['warehouse', 'readonly', 'driver', 'delivery_driver'],
            array_map(fn ($role) => [$role], ['warehouse', 'readonly', 'driver', 'delivery_driver']),
        );
    }

    private function authenticate(string $role, bool $delete = true): void
    {
        $actor = PolicyEScenario::actor([], $role);
        $actor->permissions = ['beneficiaries' => ['view' => true, 'delete' => $delete]];
        $actor->save();
        $this->assertSame($delete, $actor->fresh()->permissions['beneficiaries']['delete']);
        Sanctum::actingAs($actor);
    }

    /** Two valid households with distinct children, not nonexistent-ID authorization tests. */
    private function households(): array
    {
        $a = PolicyEScenario::beneficiary();
        $b = PolicyEScenario::beneficiary();
        $own = $a->dependents()->create(['name' => 'Synthetic owned child', 'relationship' => 'child']);
        $foreign = $b->dependents()->create(['name' => 'Synthetic other child', 'relationship' => 'child']);
        $this->assertDatabaseHas('dependents', ['id' => $own->id, 'beneficiary_id' => $a->id]);
        $this->assertDatabaseHas('dependents', ['id' => $foreign->id, 'beneficiary_id' => $b->id]);

        return [$a, $b, $own, $foreign];
    }

    private function endpoint(Beneficiary $parent, string $child): string
    {
        return "/api/beneficiaries/{$parent->id}/dependents/{$child}";
    }

    /** Hash complete persisted row sets without exposing sensitive fixture values. */
    private function persistedState(?string $omitDependent = null): array
    {
        $state = [];
        foreach (DB::getSchemaBuilder()->getTableListing() as $table) {
            $query = DB::table($table);
            if ($omitDependent !== null && preg_replace('/^main\./', '', $table) === 'dependents') {
                $query->where('id', '!=', $omitDependent);
            }
            $state[$table] = hash('sha256', json_encode($query->get(), JSON_THROW_ON_ERROR));
        }

        return $state;
    }

    #[DataProvider('permittedRoles')]
    public function test_foreign_child_cannot_be_deleted_through_another_valid_parent(string $role): void
    {
        $this->authenticate($role);
        [$a, $b, $own, $foreign] = $this->households();
        $before = $this->persistedState();

        $response = $this->deleteJson($this->endpoint($a, $foreign->id));

        $response->assertNotFound();
        $this->assertStringNotContainsString($foreign->name, $response->getContent());
        $this->assertDatabaseHas('dependents', ['id' => $foreign->id, 'beneficiary_id' => $b->id]);
        $this->assertDatabaseHas('dependents', ['id' => $own->id, 'beneficiary_id' => $a->id]);
        $this->assertSame($before, $this->persistedState());
    }

    #[DataProvider('permittedRoles')]
    public function test_correct_parent_deletion_preserves_all_unrelated_state(string $role): void
    {
        $this->authenticate($role);
        [$a, $b, $own, $foreign] = $this->households();
        $unrelated = $this->persistedState($own->id);

        $this->deleteJson($this->endpoint($a, $own->id))->assertOk()->assertJson(['success' => true]);

        $this->assertDatabaseMissing('dependents', ['id' => $own->id]);
        $this->assertDatabaseHas('dependents', ['id' => $foreign->id, 'beneficiary_id' => $b->id]);
        $this->assertSame($unrelated, $this->persistedState());
    }

    #[DataProvider('forbiddenRoles')]
    public function test_forbidden_role_cannot_delete_matching_or_foreign_child(string $role): void
    {
        $this->authenticate($role);
        [$a, $b, $own, $foreign] = $this->households();
        $before = $this->persistedState();

        $this->deleteJson($this->endpoint($a, $own->id))->assertForbidden();
        $this->assertSame($before, $this->persistedState());
        $this->deleteJson($this->endpoint($a, $foreign->id))->assertForbidden();
        $this->assertSame($before, $this->persistedState());
    }

    #[DataProvider('permittedRoles')]
    public function test_missing_child_does_not_delete_existing_dependents(string $role): void
    {
        $this->authenticate($role);
        [$a] = $this->households();
        $before = $this->persistedState();
        $missing = (string) Str::uuid();
        $this->assertDatabaseMissing('dependents', ['id' => $missing]);

        $this->deleteJson($this->endpoint($a, $missing))->assertNotFound();

        $this->assertSame($before, $this->persistedState());
    }

    public function test_missing_delete_permission_cannot_mutate_existing_child(): void
    {
        $this->authenticate('assistant_admin', false);
        [$a, $b, $own, $foreign] = $this->households();
        $before = $this->persistedState();

        $this->deleteJson($this->endpoint($a, $own->id))->assertForbidden();
        $this->assertSame($before, $this->persistedState());
        $this->deleteJson($this->endpoint($a, $foreign->id))->assertForbidden();
        $this->assertSame($before, $this->persistedState());
    }

    public function test_guest_cannot_mutate_existing_child(): void
    {
        [$a, $b, $own, $foreign] = $this->households();
        $before = $this->persistedState();

        $this->deleteJson($this->endpoint($a, $own->id))->assertUnauthorized();
        $this->assertSame($before, $this->persistedState());
        $this->deleteJson($this->endpoint($a, $foreign->id))->assertUnauthorized();
        $this->assertSame($before, $this->persistedState());
    }
}
