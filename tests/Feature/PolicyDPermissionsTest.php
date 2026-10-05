<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Support\PolicyDScenario as Scenario;
use Tests\TestCase;

class PolicyDPermissionsTest extends TestCase
{
    use RefreshDatabase;

    public function test_capabilities_and_real_resource_not_found(): void
    {
        $admin = Scenario::actor();
        $e = Scenario::evaluation($admin);
        Sanctum::actingAs(Scenario::actor(['view_documents'], 'staff'));
        $this->getJson('/api/beneficiary-policy/evaluations/'.$e->id.'/review')->assertOk()
            ->assertJsonPath('data.capabilities.view_documents', true)->assertJsonPath('data.capabilities.decide', false)
            ->assertJsonPath('data.capabilities.verify_documents', false)->assertJsonPath('data.capabilities.social_assessment', false)->assertJsonPath('data.capabilities.review', false);
        $this->getJson('/api/beneficiary-policy/evaluations/00000000-0000-0000-0000-000000000000/review')->assertNotFound();
        Sanctum::actingAs($admin);
        $this->getJson('/api/beneficiary-policy/evaluations/'.$e->id.'/review')->assertOk()->assertJsonPath('data.capabilities.decide', true);
    }
}
