<?php

namespace Tests\Feature\Phase2;

use App\Models\Beneficiary;
use App\Models\BeneficiaryPolicyEvaluation;
use App\Models\InventoryItem;
use App\Models\InventoryMovement;
use App\Models\PolicyDecision;
use App\Models\SupportDistribution;
use App\Models\SupportReceipt;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\Support\PolicyEScenario;
use Tests\TestCase;

class PolicySupportInitiationTest extends TestCase
{
    use RefreshDatabase;

    public function test_eligible_non_archived_beneficiary_creates_a_draft_without_receipt_or_stock(): void
    {
        $operator = $this->operator();
        Sanctum::actingAs($operator);
        $beneficiary = $this->beneficiary('EKRAM-E2E-TEST eligible beneficiary', '1900000101');
        $this->qualify($beneficiary, $operator);
        $stock = $this->stock();
        $beforeMovements = InventoryMovement::count();

        $response = $this->postJson('/api/support/distributions', $this->draftPayload($beneficiary, $stock));

        $response->assertCreated();
        $id = $response->json('data.id');
        $this->assertNotEmpty($id);
        $this->assertSame('draft', $response->json('data.status'));
        $this->assertSame('beneficiary', $response->json('data.recipient_type'));
        $this->assertSame('delivery', $response->json('data.fulfillment_method'));
        $this->assertNull($response->json('data.completed_at'));
        $this->assertDatabaseHas('support_distributions', [
            'id' => $id,
            'beneficiary_id' => $beneficiary->id,
            'recipient_type' => 'beneficiary',
            'fulfillment_method' => 'delivery',
            'status' => 'draft',
            'completed_at' => null,
        ]);
        $this->assertSame(1, SupportDistribution::count());
        $this->assertSame(0, SupportReceipt::where('support_distribution_id', $id)->count());
        $this->assertSame(0, SupportReceipt::count());
        $stock->refresh();
        $this->assertEquals(20, (float) $stock->current_quantity);
        $this->assertEquals(0, (float) $stock->reserved_quantity);
        $this->assertSame($beforeMovements, InventoryMovement::count());
    }

    public function test_archived_beneficiary_is_rejected_and_creates_no_distribution(): void
    {
        $operator = $this->operator();
        Sanctum::actingAs($operator);
        $beneficiary = $this->beneficiary('EKRAM-E2E-TEST archived beneficiary', '1900000102', [
            'archived_at' => now(),
            'archived_by' => $operator->id,
            'archive_reason' => 'EKRAM-E2E-TEST archive',
        ]);
        $stock = $this->stock();
        $distributions = SupportDistribution::count();
        $receipts = SupportReceipt::count();

        $response = $this->postJson('/api/support/distributions', $this->draftPayload($beneficiary, $stock));

        $response->assertUnprocessable();
        $response->assertJsonValidationErrors(['beneficiary_id']);
        $response->assertJsonPath('errors.beneficiary_id.0', 'لا يمكن إنشاء دعم جديد لمستفيد مؤرشف.');
        $this->assertSame($distributions, SupportDistribution::count());
        $this->assertSame($receipts, SupportReceipt::count());
        $this->assertDatabaseMissing('support_distributions', ['beneficiary_id' => $beneficiary->id]);
    }

    public function test_support_without_policy_evaluation_is_rejected_without_side_effects(): void
    {
        Sanctum::actingAs($this->operator());
        $beneficiary = $this->beneficiary('EKRAM-E2E-TEST unevaluated beneficiary', '1900000104');
        $stock = $this->stock();

        $response = $this->postJson('/api/support/distributions', $this->draftPayload($beneficiary, $stock));

        $response->assertUnprocessable();
        $response->assertJsonPath('errors.beneficiary_id.0', 'لا يمكن تقديم الدعم قبل إكمال تقييم سياسة المستفيد.');
        $this->assertSame(0, SupportDistribution::count());
        $this->assertSame(0, InventoryMovement::count());
        $stock->refresh();
        $this->assertEquals(0, (float) $stock->reserved_quantity);
    }

    public function test_support_with_ineligible_evaluation_is_rejected_without_side_effects(): void
    {
        $operator = $this->operator();
        Sanctum::actingAs($operator);
        $beneficiary = $this->beneficiary('EKRAM-E2E-TEST ineligible beneficiary', '1900000105');
        $this->qualify($beneficiary, $operator, 'ineligible');
        $stock = $this->stock();

        $response = $this->postJson('/api/support/distributions', $this->draftPayload($beneficiary, $stock));

        $response->assertUnprocessable();
        $response->assertJsonPath('errors.beneficiary_id.0', 'المستفيد غير مؤهل للدعم وفق آخر تقييم سياسة صالح.');
        $this->assertSame(0, SupportDistribution::count());
        $this->assertSame(0, InventoryMovement::count());
    }

    public function test_support_with_incomplete_review_is_rejected_without_side_effects(): void
    {
        $operator = $this->operator();
        Sanctum::actingAs($operator);
        $beneficiary = $this->beneficiary('EKRAM-E2E-TEST pending review beneficiary', '1900000106');
        $this->qualify($beneficiary, $operator, 'eligible', false);
        $stock = $this->stock();

        $response = $this->postJson('/api/support/distributions', $this->draftPayload($beneficiary, $stock));

        $response->assertUnprocessable();
        $response->assertJsonPath('errors.beneficiary_id.0', 'لا يمكن تقديم الدعم قبل استكمال مراجعة السياسة.');
        $this->assertSame(0, SupportDistribution::count());
        $this->assertSame(0, InventoryMovement::count());
        $this->assertSame(0, SupportReceipt::count());
        $stock->refresh();
        $this->assertEquals(20, (float) $stock->current_quantity);
        $this->assertEquals(0, (float) $stock->reserved_quantity);
    }

    public function test_policy_simulation_does_not_write_a_policy_decision(): void
    {
        $actor = $this->operator();
        $version = PolicyEScenario::published($actor, [
            'application_scope' => ['applies_to' => 'all_existing_and_new'],
        ]);
        PolicyEScenario::beneficiary([
            'full_name' => 'EKRAM-E2E-TEST policy beneficiary',
            'national_id' => '1900000103',
            'phone' => '0500000103',
        ]);
        $decisions = PolicyDecision::count();
        $evaluations = BeneficiaryPolicyEvaluation::count();

        $run = PolicyEScenario::simulate(PolicyEScenario::run($version, [], $actor), $actor);

        $this->assertSame('simulated', $run->status);
        $this->assertSame($decisions, PolicyDecision::count());
        $this->assertSame(0, PolicyDecision::count());
        $this->assertSame($evaluations, BeneficiaryPolicyEvaluation::count());
        $this->assertSame(0, BeneficiaryPolicyEvaluation::count());
    }

    private function operator(): User
    {
        $suffix = Str::lower(Str::random(8));

        return User::create([
            'username' => 'ekram-e2e-test-'.$suffix,
            'full_name' => 'EKRAM-E2E-TEST operator',
            'email' => 'ekram-e2e-test-'.$suffix.'@example.invalid',
            'password' => Str::random(24),
            'role' => 'admin',
            'is_active' => true,
            'can_receive_notifications' => false,
        ]);
    }

    private function beneficiary(string $name, string $nationalId, array $overrides = []): Beneficiary
    {
        return Beneficiary::create(array_merge([
            'beneficiary_type' => 'citizen',
            'full_name' => $name,
            'national_id' => $nationalId,
            'phone' => '0500000101',
            'date_of_birth' => '1980-05-05',
            'family_status' => 'poor',
            'family_members_count' => 1,
            'housing_type' => 'own',
            'income_sources' => ['salary'],
            'monthly_salary' => 500,
            'social_security_amount' => 0,
            'citizen_account_amount' => 0,
            'retirement_pension' => 0,
            'family_support' => 0,
            'status' => 'active',
        ], $overrides));
    }

    private function stock(): InventoryItem
    {
        return InventoryItem::create([
            'name' => 'EKRAM-E2E-TEST stock',
            'unit' => 'kg',
            'current_quantity' => 20,
            'reserved_quantity' => 0,
            'min_threshold' => 1,
        ]);
    }

    private function qualify(Beneficiary $beneficiary, User $actor, string $eligibility = 'eligible', bool $approved = true): void
    {
        $version = \App\Models\BeneficiaryPolicyVersion::create([
            'policy_name' => 'EKRAM-E2E-TEST policy '.Str::lower(Str::random(4)),
            'policy_scope' => 'citizen_beneficiaries',
            'version' => Str::upper(Str::random(6)),
            'status' => 'published',
            'effective_from' => now()->toDateString(),
            'configuration' => [],
            'published_by' => $actor->id,
            'published_at' => now(),
        ]);
        $evaluation = BeneficiaryPolicyEvaluation::create([
            'beneficiary_id' => $beneficiary->id,
            'policy_version_id' => $version->id,
            'evaluation_status' => 'completed',
            'evaluated_at' => now(),
            'evaluated_by' => $actor->id,
            'eligibility_decision' => $eligibility,
            'input_snapshot' => [],
            'financial_snapshot' => ['net_income_per_capita' => 100],
            'scoring_snapshot' => ['outcome' => 'financially_qualified', 'components' => [], 'total_score' => 0],
        ]);
        if (! $approved) {
            return;
        }
        \App\Models\PolicyDecision::create([
            'evaluation_id' => $evaluation->id,
            'policy_version_id' => $version->id,
            'decision' => 'approved',
            'decided_by' => $actor->id,
            'decided_at' => now(),
            'stable_reason_code' => 'COMPLETE',
            'human_readable_reason' => 'EKRAM-E2E-TEST approval',
        ]);
    }

    private function draftPayload(Beneficiary $beneficiary, InventoryItem $stock): array
    {
        return [
            'recipient_type' => 'beneficiary',
            'beneficiary_id' => $beneficiary->id,
            'fulfillment_method' => 'delivery',
            'items' => [[
                'inventory_item_id' => $stock->id,
                'requested_quantity' => '1',
            ]],
        ];
    }
}
