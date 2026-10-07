<?php

namespace Tests\Support;

use App\Models\Beneficiary;
use App\Models\BeneficiaryPolicyEvaluation;
use App\Models\BeneficiaryPolicyVersion;
use App\Models\PolicyDecision;
use App\Models\User;
use Illuminate\Support\Str;

/**
 * Gives a beneficiary the completed, currently effective, approved evaluation
 * that support creation requires. Does not change the eligibility rule.
 */
final class EligibleSupport
{
    public static function approve(Beneficiary $beneficiary, User $actor): void
    {
        $today = now()->toDateString();
        $version = BeneficiaryPolicyVersion::query()
            ->where('policy_scope', 'citizen_beneficiaries')
            ->where('status', 'published')
            ->whereDate('effective_from', $today)
            ->first();
        if (! $version) {
            $version = BeneficiaryPolicyVersion::create([
                'policy_name' => 'EKRAM-E2E-TEST policy '.Str::lower(Str::random(4)),
                'policy_scope' => 'citizen_beneficiaries',
                'version' => Str::upper(Str::random(6)),
                'status' => 'published',
                'effective_from' => $today,
                'configuration' => [],
                'published_by' => $actor->id,
                'published_at' => now(),
            ]);
        }
        $evaluation = BeneficiaryPolicyEvaluation::create([
            'beneficiary_id' => $beneficiary->id,
            'policy_version_id' => $version->id,
            'evaluation_status' => 'completed',
            'evaluated_at' => now(),
            'evaluated_by' => $actor->id,
            'eligibility_decision' => 'eligible',
            'input_snapshot' => [],
            'financial_snapshot' => ['net_income_per_capita' => 100],
            'scoring_snapshot' => ['outcome' => 'financially_qualified', 'components' => [], 'total_score' => 0],
        ]);
        PolicyDecision::create([
            'evaluation_id' => $evaluation->id,
            'policy_version_id' => $version->id,
            'decision' => 'approved',
            'decided_by' => $actor->id,
            'decided_at' => now(),
            'stable_reason_code' => 'COMPLETE',
            'human_readable_reason' => 'EKRAM-E2E-TEST approval',
        ]);
    }
}
