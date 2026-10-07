<?php

namespace Tests\Feature\Phase3;

use App\Models\Beneficiary;
use App\Models\BeneficiaryPolicyEvaluation;
use App\Services\BeneficiaryPolicy\BeneficiaryPolicyEvaluationService;
use App\Services\BeneficiaryPolicy\PolicyFinancialEvaluationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\Support\PolicyEScenario;
use Tests\TestCase;

class OperationalPolicyValidityTest extends TestCase
{
    use RefreshDatabase;

    public function test_currently_effective_published_policy_is_accepted_and_breakdown_matches_the_score(): void
    {
        $actor = PolicyEScenario::actor();
        $beneficiary = PolicyEScenario::beneficiary();
        $version = PolicyEScenario::published($actor, [], ['effective_from' => now()->toDateString()]);

        $evaluation = app(PolicyFinancialEvaluationService::class)->evaluate($beneficiary->id, $version->id, $actor->id);

        $components = $evaluation->scoring_snapshot['components'];
        $total = array_sum(array_map(static fn (array $component) => $component['points'] ?? 0, $components));
        $this->assertEquals($total, (float) $evaluation->policy_score);
        $this->assertSame($components[0]['dimension'], $evaluation->scoring_snapshot['breakdown'][0]['rule_id']);
        $this->assertArrayHasKey('awarded_points', $evaluation->scoring_snapshot['breakdown'][0]);
        $this->assertArrayHasKey('max_points', $evaluation->scoring_snapshot['breakdown'][0]);
        $this->assertArrayHasKey('condition', $evaluation->scoring_snapshot['breakdown'][0]);
    }

    public function test_future_effective_published_policy_is_rejected(): void
    {
        $actor = PolicyEScenario::actor();
        $beneficiary = PolicyEScenario::beneficiary();
        $version = PolicyEScenario::published($actor, [], ['effective_from' => now()->addYear()->toDateString()]);

        try {
            app(PolicyFinancialEvaluationService::class)->evaluate($beneficiary->id, $version->id, $actor->id);
            $this->fail('A future policy must not be evaluated.');
        } catch (ValidationException $exception) {
            $this->assertSame('لا يمكن تقييم المستفيد على نسخة لم يبدأ سريانها بعد.', $exception->errors()['policy_version_id'][0]);
        }
        $this->assertSame(0, BeneficiaryPolicyEvaluation::count());
    }

    public function test_draft_policy_is_rejected(): void
    {
        $actor = PolicyEScenario::actor();
        $beneficiary = PolicyEScenario::beneficiary();
        $version = PolicyEScenario::version();

        try {
            app(PolicyFinancialEvaluationService::class)->evaluate($beneficiary->id, $version->id, $actor->id);
            $this->fail('A draft policy must not be evaluated.');
        } catch (HttpException $exception) {
            $this->assertSame(409, $exception->getStatusCode());
        }
        $this->assertSame(0, BeneficiaryPolicyEvaluation::count());
    }

    public function test_expired_policy_is_rejected_and_an_existing_snapshot_stays_immutable(): void
    {
        $actor = PolicyEScenario::actor();
        $beneficiary = PolicyEScenario::beneficiary();
        $version = PolicyEScenario::published($actor, [], [
            'effective_from' => now()->subYear()->toDateString(),
            'effective_to' => now()->subDay()->toDateString(),
        ]);
        $historical = app(BeneficiaryPolicyEvaluationService::class)->create([
            'beneficiary_id' => $beneficiary->id,
            'policy_version_id' => $version->id,
            'eligibility_decision' => 'eligible',
            'policy_score' => 12,
            'input_snapshot' => ['family_status' => 'poor'],
            'scoring_snapshot' => ['total_score' => 12, 'components' => []],
        ], $actor->id);
        $beneficiary->update(['full_name' => 'اسم بعد التقييم']);

        try {
            app(PolicyFinancialEvaluationService::class)->evaluate($beneficiary->id, $version->id, $actor->id);
            $this->fail('An expired policy must not be evaluated.');
        } catch (ValidationException $exception) {
            $this->assertSame('لا يمكن تقييم المستفيد على نسخة منتهية السريان.', $exception->errors()['policy_version_id'][0]);
        }

        $historical->refresh();
        $this->assertSame('poor', $historical->input_snapshot['family_status']);
        $this->assertEquals(12, (float) $historical->policy_score);
        $this->assertSame(1, BeneficiaryPolicyEvaluation::count());
    }

    public function test_re_evaluation_creates_a_new_record(): void
    {
        $actor = PolicyEScenario::actor();
        $beneficiary = PolicyEScenario::beneficiary();
        $version = PolicyEScenario::published($actor);
        $service = app(PolicyFinancialEvaluationService::class);
        $first = $service->evaluate($beneficiary->id, $version->id, $actor->id);
        $second = $service->evaluate($beneficiary->id, $version->id, $actor->id);

        $this->assertNotSame($first->id, $second->id);
        $this->assertEquals($first->policy_score, $first->fresh()->policy_score);
        $this->assertSame(2, BeneficiaryPolicyEvaluation::where('beneficiary_id', $beneficiary->id)->count());
    }
}
