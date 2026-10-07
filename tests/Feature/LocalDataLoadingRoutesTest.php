<?php

namespace Tests\Feature;

use App\Models\Beneficiary;
use App\Models\BeneficiaryPolicyVersion;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class LocalDataLoadingRoutesTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Sanctum::actingAs(User::create(['username' => 'TEST_LOCAL_DATA', 'full_name' => 'TEST Local Data',
            'password' => 'test-password', 'role' => 'admin', 'is_active' => true]));
    }

    public function test_static_unified_route_bypasses_model_binding_and_returns_empty_data(): void
    {
        $route = app('router')->getRoutes()->match(Request::create('/api/beneficiaries/unified', 'GET'));
        $this->assertStringEndsWith('@unifiedIndex', $route->getActionName());
        $this->assertArrayNotHasKey('beneficiary', $route->parameters());
        $this->getJson('/api/beneficiaries/unified')->assertOk()->assertJsonPath('data.total', 0)
            ->assertJsonPath('data.data', []);
    }

    public function test_uuid_detail_route_keeps_implicit_binding_and_edit_route(): void
    {
        $beneficiary = Beneficiary::create(['full_name' => 'TEST Beneficiary', 'beneficiary_type' => 'citizen',
            'national_id' => '1000000001', 'phone' => '0500000001']);
        $this->getJson('/api/beneficiaries/'.$beneficiary->id)->assertOk()->assertJsonPath('data.id', $beneficiary->id);
        $route = app('router')->getRoutes()->match(Request::create('/api/beneficiaries/'.$beneficiary->id, 'PATCH'));
        $this->assertStringEndsWith('@update', $route->getActionName());
        $this->getJson('/api/beneficiaries/not-a-uuid')->assertNotFound();
    }

    public function test_policy_versions_empty_response_and_permission_contract(): void
    {
        $this->getJson('/api/beneficiary-policy/permissions')->assertOk()->assertJsonPath('data.view', true);
        $this->getJson('/api/beneficiary-policy/versions')->assertOk()->assertJsonPath('data', []);
    }

    public function test_policy_versions_lists_drafts_and_published_with_unchanged_view_permission(): void
    {
        foreach (['draft', 'published'] as $status) {
            BeneficiaryPolicyVersion::create(['policy_name' => 'TEST Policy', 'version' => $status,
                'status' => $status, 'policy_scope' => 'citizen_beneficiaries', 'effective_from' => '2026-10-01',
                'configuration' => []]);
        }
        $this->getJson('/api/beneficiary-policy/versions')->assertOk()->assertJsonCount(2, 'data');
        Sanctum::actingAs(User::create(['username' => 'TEST_LOCAL_READER', 'full_name' => 'TEST Reader',
            'password' => 'test-password', 'role' => 'staff', 'is_active' => true, 'permissions' => []]));
        $this->getJson('/api/beneficiary-policy/versions')->assertForbidden();
    }
}
