<?php

namespace Tests\Feature\Phase2;

use App\Models\Beneficiary;
use App\Models\InventoryItem;
use App\Models\SupportDistribution;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PermissionSeparationTest extends TestCase
{
    use RefreshDatabase;

    public function test_beneficiary_create_is_separate_from_import_and_a_denied_create_writes_nothing(): void
    {
        $user = $this->staff([
            'beneficiaries' => ['view' => true, 'create' => true, 'edit' => false, 'delete' => false, 'import' => false],
            'support' => ['view' => true, 'create' => false],
        ]);
        Sanctum::actingAs($user);

        $this->postJson('/api/beneficiaries', $this->beneficiaryPayload('1000000101'))->assertCreated();
        $this->assertSame(1, Beneficiary::count());
        $this->assertSame(0, SupportDistribution::count());

        $user->update([
            'permissions' => [
                'beneficiaries' => ['view' => true, 'create' => false, 'edit' => false, 'delete' => false, 'import' => true],
                'support' => ['view' => true, 'create' => false],
            ],
        ]);
        Sanctum::actingAs($user->fresh());

        $denied = $this->postJson('/api/beneficiaries', $this->beneficiaryPayload('1000000102'));
        $denied->assertForbidden();
        $this->assertNotSame(404, $denied->status());
        $this->assertSame(1, Beneficiary::count());
        $this->assertSame(0, SupportDistribution::count());
        $this->assertDatabaseMissing('beneficiaries', ['national_id' => '1000000102']);
    }

    public function test_support_create_is_separate_from_beneficiary_create_and_a_denied_request_writes_nothing(): void
    {
        $admin = $this->staff([], 'admin');
        Sanctum::actingAs($admin);
        $beneficiaryId = $this->postJson('/api/beneficiaries', $this->beneficiaryPayload('1000000103'))
            ->assertCreated()
            ->json('data.id');
        \Tests\Support\EligibleSupport::approve(Beneficiary::findOrFail($beneficiaryId), $admin);
        $stock = InventoryItem::create([
            'name' => 'TEST_AUTH stock',
            'unit' => 'kg',
            'current_quantity' => 20,
            'min_threshold' => 1,
        ]);
        $payload = [
            'recipient_type' => 'beneficiary',
            'beneficiary_id' => $beneficiaryId,
            'fulfillment_method' => 'delivery',
            'items' => [['inventory_item_id' => $stock->id, 'requested_quantity' => '1']],
        ];

        $allowed = $this->staff([
            'beneficiaries' => ['view' => true, 'create' => false, 'import' => false],
            'support' => ['view' => false, 'create' => true, 'edit' => false, 'fulfill' => false],
        ]);
        Sanctum::actingAs($allowed);
        $createdId = $this->postJson('/api/support/distributions', $payload)->assertCreated()->json('data.id');
        $this->assertSame(1, Beneficiary::count());
        $this->assertSame(1, SupportDistribution::count());
        $this->assertDatabaseHas('support_distributions', ['id' => $createdId, 'beneficiary_id' => $beneficiaryId]);

        $deniedUser = $this->staff([
            'beneficiaries' => ['view' => true, 'create' => true, 'edit' => true, 'delete' => true, 'import' => true],
            'support' => ['view' => true, 'create' => false, 'edit' => true, 'fulfill' => true],
        ]);
        Sanctum::actingAs($deniedUser);
        $denied = $this->postJson('/api/support/distributions', $payload);
        $denied->assertForbidden();
        $this->assertNotSame(404, $denied->status());
        $this->assertSame(1, Beneficiary::count());
        $this->assertSame(1, SupportDistribution::count());
        $this->assertDatabaseHas('support_distributions', ['id' => $createdId]);
    }

    private function staff(array $permissions, string $role = 'staff'): User
    {
        $suffix = Str::lower(Str::random(8));

        return User::create([
            'username' => 'TEST_AUTH_'.$suffix,
            'full_name' => 'TEST_AUTH user',
            'email' => 'test-auth-'.$suffix.'@example.invalid',
            'password' => Str::random(24),
            'role' => $role,
            'is_active' => true,
            'can_receive_notifications' => false,
            'permissions' => $permissions,
        ]);
    }

    private function beneficiaryPayload(string $nationalId): array
    {
        return [
            'reviewed_confirmation' => true,
            'full_name' => 'TEST_AUTH beneficiary '.$nationalId,
            'national_id' => $nationalId,
            'phone' => '0500000101',
            'beneficiary_type' => 'citizen',
            'nationality' => 'سعودي',
            'city' => 'TEST_AUTH',
            'district' => 'TEST_AUTH',
            'street' => 'TEST_AUTH',
            'date_of_birth' => '1990-01-01',
            'family_status' => 'poor',
            'family_members_count' => 1,
            'housing_type' => 'own',
            'status' => 'active',
            'income_sources' => ['salary'],
            'monthly_salary' => 700,
        ];
    }
}
