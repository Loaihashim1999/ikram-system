<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\InventoryItem;
use App\Services\BeneficiaryPolicy\PolicyFinancialEvaluationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;
use Tests\Support\PolicyEScenario;
use Tests\TestCase;

class BeneficiaryLifecycleTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Queue::fake();
        Sanctum::actingAs(PolicyEScenario::actor());
    }

    public function test_registration_cannot_bypass_explicit_review(): void
    {
        $this->postJson('/api/beneficiaries', [])->assertUnprocessable()->assertJsonValidationErrors('reviewed_confirmation');
        $this->postJson('/api/beneficiaries', ['reviewed_confirmation' => false])->assertUnprocessable()->assertJsonValidationErrors('reviewed_confirmation');
        $this->assertDatabaseCount('beneficiaries', 0);
    }

    public function test_archive_preserves_household_and_is_idempotent(): void
    {
        $b = PolicyEScenario::beneficiary();
        $child = $b->dependents()->create(['name' => 'EKRAM-E2E-TEST child', 'relationship' => 'child']);
        $this->deleteJson('/api/beneficiaries/'.$b->id)->assertOk();
        $this->deleteJson('/api/beneficiaries/'.$b->id)->assertOk();
        $this->assertNotNull($b->fresh()->archived_at);
        $this->assertDatabaseHas('dependents', ['id' => $child->id]);
        $this->assertSame(1, AuditLog::where('action', 'BENEFICIARY_ARCHIVED')->where('target_id', $b->id)->count());
        $this->getJson('/api/beneficiaries')->assertOk()->assertJsonPath('data.total', 0);
        $this->getJson('/api/beneficiaries?archived=only')->assertOk()->assertJsonPath('data.total', 1);
        $this->getJson('/api/beneficiaries/'.$b->id)->assertOk();
        $this->postJson('/api/beneficiaries/'.$b->id.'/restore')->assertOk();
        $this->assertNull($b->fresh()->archived_at);
        $this->assertDatabaseHas('dependents', ['id' => $child->id]);
    }

    public function test_archiving_requires_delete_authority_on_real_record(): void
    {
        $b = PolicyEScenario::beneficiary();
        $actor = PolicyEScenario::actor([], 'staff');
        $actor->permissions = ['beneficiaries' => ['view' => true, 'delete' => false]];
        $actor->save();
        Sanctum::actingAs($actor);
        $this->deleteJson('/api/beneficiaries/'.$b->id)->assertForbidden();
        $this->assertNull($b->fresh()->archived_at);
    }

    public function test_archived_beneficiary_cannot_receive_new_support_but_history_remains(): void
    {
        $b = PolicyEScenario::beneficiary(['beneficiary_type' => 'resident']);
        \Tests\Support\EligibleSupport::approve($b, \Illuminate\Support\Facades\Auth::user());
        $stock = InventoryItem::create(['name' => 'EKRAM-E2E-TEST stock', 'unit' => 'kg', 'current_quantity' => 20]);
        $payload = ['recipient_type' => 'beneficiary', 'beneficiary_id' => $b->id, 'fulfillment_method' => 'delivery',
            'items' => [['inventory_item_id' => $stock->id, 'requested_quantity' => '1']]];
        $support = $this->postJson('/api/support/distributions', $payload)->assertCreated()->json('data.id');
        $this->deleteJson('/api/beneficiaries/'.$b->id)->assertOk();
        $this->postJson('/api/support/distributions', $payload)->assertUnprocessable()->assertJsonValidationErrors('beneficiary_id');
        $this->assertDatabaseHas('support_distributions', ['id' => $support, 'beneficiary_id' => $b->id]);
        $this->assertDatabaseCount('support_distributions', 1);
    }

    public function test_policy_history_returns_actual_resident_result_without_identity_snapshot(): void
    {
        $actor = Auth::user();
        $version = PolicyEScenario::published($actor);
        $b = PolicyEScenario::beneficiary(['beneficiary_type' => 'resident']);
        $evaluation = app(PolicyFinancialEvaluationService::class)->evaluate($b->id, $version->id, $actor->id);
        $response = $this->getJson('/api/beneficiary-policy/beneficiaries/'.$b->id.'/evaluations')->assertOk();
        $response->assertJsonPath('data.0.id', $evaluation->id)->assertJsonPath('data.0.eligibility_decision', 'not_applicable')
            ->assertJsonPath('data.0.eligibility_reasons.0', 'POLICY_NOT_APPLICABLE_RESIDENT')->assertJsonPath('data.0.current_state', 'pending');
        $this->assertArrayNotHasKey('input_snapshot', $response->json('data.0'));
        $this->assertArrayNotHasKey('national_id', $response->json('data.0'));
    }

    public function test_legacy_records_are_not_falsely_confirmed(): void
    {
        $b = PolicyEScenario::beneficiary();
        $this->assertNull($b->confirmed_at);
        $this->assertNull($b->confirmed_by);
    }
}
