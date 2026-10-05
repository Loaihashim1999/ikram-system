<?php

namespace Tests\Support;

use App\Models\Beneficiary;
use App\Models\BeneficiaryPolicyVersion;
use App\Models\User;
use App\Services\BeneficiaryPolicy\PolicyConfigurationValidator;
use App\Services\BeneficiaryPolicy\PolicyDocumentVerificationService;
use App\Services\BeneficiaryPolicy\PolicyFinancialEvaluationService;
use App\Services\BeneficiaryPolicy\PolicyReviewService;
use App\Services\BeneficiaryPolicy\SocialAssessmentService;
use Illuminate\Support\Str;

final class PolicyDScenario
{
    public static function actor(array $permissions = [], string $role = 'admin'): User
    {
        return User::create(['username' => 'TEST_'.Str::uuid(), 'full_name' => 'TEST POLICY D', 'password' => 'test-password', 'role' => $role, 'is_active' => true, 'permissions' => ['beneficiary_policy' => array_fill_keys($permissions, true)]]);
    }

    public static function evaluation(User $actor)
    {
        $b = Beneficiary::create(['beneficiary_type' => 'citizen', 'full_name' => 'TEST POLICY D BENEFICIARY', 'national_id' => '1'.random_int(100000000, 999999999), 'phone' => '0500000000', 'date_of_birth' => '1980-05-05', 'status' => 'active', 'family_status' => 'poor', 'housing_type' => 'own', 'monthly_salary' => 500, 'family_members_count' => 1]);
        $v = BeneficiaryPolicyVersion::where('status', 'published')->first() ?? BeneficiaryPolicyVersion::create(['policy_name' => 'TEST POLICY D', 'version' => 'v-d', 'policy_scope' => 'citizen_beneficiaries', 'effective_from' => '2026-01-01', 'status' => 'published', 'configuration' => PolicyConfigurationValidator::withDefaults([])]);

        return app(PolicyFinancialEvaluationService::class)->evaluate($b->id, $v->id, $actor->id);
    }

    public static function assessment(): array
    {
        return ['assessment_date' => '2026-09-22', 'housing_condition' => 'poor', 'service_area_result' => 'verified_inside', 'landlord_relationship_result' => 'no_prohibited_relationship', 'household_findings' => ['affected_children_count' => 2]];
    }

    public static function complete($e, User $actor): void
    {
        $service = app(PolicyDocumentVerificationService::class);
        foreach (app(PolicyReviewService::class)->data($e)['documents'] as $d) {
            if ($d['applicable'] && $d['required']) {
                $service->verify($e->beneficiary_id, $d['code'], null, ['evaluation_id' => $e->id, 'verified_by' => $actor->id, 'verified_at' => now(), 'evidence_reference' => 'TEST_EVIDENCE']);
            }
        }
        $service->medical(['evaluation_id' => $e->id, 'beneficiary_id' => $e->beneficiary_id, 'verification_status' => 'verified', 'verified_disability_percentage' => 50, 'verified_by' => $actor->id, 'verified_at' => now(), 'evidence_reference' => 'TEST_MEDICAL']);
        $social = app(SocialAssessmentService::class);
        $a = $social->create(array_merge(self::assessment(), ['evaluation_id' => $e->id, 'beneficiary_id' => $e->beneficiary_id, 'policy_version_id' => $e->policy_version_id, 'status' => 'draft', 'created_by' => $actor->id]));
        $social->submit($a->id, $actor->id);
        $social->review($a->id, ['structured_recommendation' => 'approve'], $actor->id);
    }
}
