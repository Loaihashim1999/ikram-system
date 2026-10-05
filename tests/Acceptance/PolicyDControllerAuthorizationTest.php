<?php

namespace Tests\Acceptance;

use App\Models\AuditLog;
use App\Models\BeneficiaryDocument;
use App\Models\PolicyDecision;
use App\Models\SocialAssessment;
use App\Services\BeneficiaryPolicy\PolicyDocumentVerificationService;
use App\Services\BeneficiaryPolicy\SocialAssessmentService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Support\PolicyDScenario as Scenario;
use Tests\TestCase;

class PolicyDControllerAuthorizationTest extends TestCase
{
    use RefreshDatabase;

    public static function endpoints(): array
    {
        return [
            ['GET', 'review', 'view_documents'], ['POST', 'documents/national_id', 'verify_documents'],
            ['POST', 'medical-evidence', 'verify_documents'], ['PUT', 'social-assessment', 'social_assessment'],
            ['POST', 'social-assessment/submit', 'social_assessment'], ['POST', 'social-assessment/review', 'review'],
            ['POST', 'approve', 'decide'], ['POST', 'reject', 'decide'],
        ];
    }

    #[DataProvider('endpoints')]
    public function test_guest_and_no_permission_are_denied_before_lookup(string $verb, string $path, string $permission): void
    {
        $url = '/api/beneficiary-policy/evaluations/00000000-0000-0000-0000-000000000000/'.$path;
        $this->json($verb, $url)->assertUnauthorized();
        Sanctum::actingAs(Scenario::actor([], 'staff'));
        $this->json($verb, $url)->assertForbidden();
    }

    #[DataProvider('endpoints')]
    public function test_permissions_are_independent(string $verb, string $path, string $permission): void
    {
        $admin = Scenario::actor();
        $e = Scenario::evaluation($admin);
        $url = '/api/beneficiary-policy/evaluations/'.$e->id.'/'.$path;
        foreach (['view_documents', 'verify_documents', 'social_assessment', 'review', 'decide'] as $grant) {
            Sanctum::actingAs(Scenario::actor([$grant], 'staff'));
            if ($verb === 'GET') {
                $this->getJson($url)->assertOk()->assertJsonPath('data.evaluation.id', $e->id);
            } elseif ($grant !== $permission) {
                $this->json($verb, $url)->assertForbidden();
            }
        }
    }

    public function test_real_workflow_audit_decision_and_immutability(): void
    {
        $admin = Scenario::actor();
        Sanctum::actingAs($admin);
        $e = Scenario::evaluation($admin);
        $before = $e->getRawOriginal();
        $base = '/api/beneficiary-policy/evaluations/'.$e->id;
        $reason = ['reason_code' => 'DOCUMENTARY_EVIDENCE_COMPLETE', 'reason_text' => 'Verified evidence'];
        $this->postJson($base.'/approve', $reason)->assertUnprocessable();
        $this->postJson($base.'/reject', [])->assertUnprocessable();
        $this->assertDatabaseCount('policy_decisions', 0);
        $review = $this->getJson($base.'/review')->assertOk()->json('data');
        $this->assertArrayNotHasKey('beneficiary', $review['evaluation']);
        $this->assertArrayNotHasKey('national_id', $review['beneficiary']);
        Sanctum::actingAs(Scenario::actor(['verify_documents'], 'staff'));
        $this->postJson($base.'/documents/national_id', ['status' => 'rejected', 'evidence_reference' => 'TEST_REF', 'rejection_reason' => 'Unreadable'])->assertOk();
        foreach ($review['documents'] as $d) {
            if ($d['applicable'] && $d['required']) {
                $this->postJson($base.'/documents/'.$d['code'], ['status' => 'verified', 'evidence_reference' => 'TEST_REF'])->assertOk();
            }
        }
        $this->postJson($base.'/medical-evidence', ['verification_status' => 'verified', 'verified_disability_percentage' => 50, 'evidence_reference' => 'TEST_MEDICAL'])->assertOk();
        Sanctum::actingAs(Scenario::actor(['social_assessment'], 'staff'));
        $this->putJson($base.'/social-assessment', Scenario::assessment())->assertOk();
        $this->putJson($base.'/social-assessment', Scenario::assessment())->assertOk();
        $this->postJson($base.'/social-assessment/submit')->assertOk();
        $this->putJson($base.'/social-assessment', Scenario::assessment())->assertConflict();
        Sanctum::actingAs(Scenario::actor(['review'], 'staff'));
        $this->postJson($base.'/social-assessment/review', ['structured_recommendation' => 'approve'])->assertOk();
        $this->postJson($base.'/approve', $reason)->assertForbidden();
        Sanctum::actingAs(Scenario::actor(['decide'], 'staff'));
        $this->postJson($base.'/approve', $reason)->assertOk()->assertJsonPath('data.decision', 'approved');
        $this->postJson($base.'/reject', $reason)->assertConflict();
        $this->getJson($base.'/review')->assertOk()->assertJsonPath('data.current_state', 'approved')->assertJsonCount(1, 'data.decision_history');
        $this->assertSame($before, $e->fresh()->getRawOriginal());
        foreach (['DOCUMENT_REJECTED', 'SOCIAL_ASSESSMENT_CREATED', 'SOCIAL_ASSESSMENT_SUBMITTED', 'SOCIAL_ASSESSMENT_REVIEWED', 'POLICY_DECISION_APPROVED'] as $event) {
            $this->assertSame(1, AuditLog::where('action', $event)->count(), $event);
        }
        $this->assertSame(4, AuditLog::where('action', 'DOCUMENT_VERIFIED')->count());
        Sanctum::actingAs($admin);
        $this->postJson($base.'/documents/national_id', ['status' => 'verified', 'evidence_reference' => 'TEST_REF'])->assertConflict();
        $other = Scenario::evaluation($admin);
        $this->postJson('/api/beneficiary-policy/evaluations/'.$other->id.'/reject', ['reason_code' => 'EVIDENCE_INSUFFICIENT', 'reason_text' => 'Missing required evidence'])->assertOk();
        $this->assertSame(1, AuditLog::where('action', 'POLICY_DECISION_REJECTED')->count());
    }

    public function test_other_evaluation_evidence_cannot_unlock_approval(): void
    {
        $admin = Scenario::actor();
        Sanctum::actingAs($admin);
        $one = Scenario::evaluation($admin);
        Scenario::complete($one, $admin);
        $two = Scenario::evaluation($admin);
        $base = '/api/beneficiary-policy/evaluations/'.$two->id;
        $this->getJson($base.'/review')->assertJsonPath('data.social_assessment', null)->assertJsonCount(0, 'data.decision_history');
        $this->postJson($base.'/approve', ['reason_code' => 'COMPLETE', 'reason_text' => 'Claim'])->assertUnprocessable();
        $this->assertSame(0, PolicyDecision::count());
    }

    public function test_medical_exact_boundaries_and_unresolved_ambiguities(): void
    {
        $admin = Scenario::actor();
        Sanctum::actingAs($admin);
        $e = Scenario::evaluation($admin);
        $base = '/api/beneficiary-policy/evaluations/'.$e->id;
        foreach ([-0.01, 100.01] as $value) {
            $this->postJson($base.'/medical-evidence', ['verification_status' => 'verified', 'verified_disability_percentage' => $value, 'evidence_reference' => 'TEST'])->assertUnprocessable();
        }
        Scenario::complete($e, $admin);
        // Simulate an authentic historical unresolved policy input, not an API override.
        $snapshot = $e->scoring_snapshot;
        $snapshot['reviews'][] = 'HEAD_AGE_UNRESOLVED';
        $e->update(['scoring_snapshot' => $snapshot]);
        $this->postJson($base.'/approve', ['reason_code' => 'COMPLETE', 'reason_text' => 'Claim'])->assertUnprocessable();
    }

    public function test_invalid_transitions_and_duplicate_submission_are_blocked(): void
    {
        $admin = Scenario::actor();
        Sanctum::actingAs($admin);
        $e = Scenario::evaluation($admin);
        $base = '/api/beneficiary-policy/evaluations/'.$e->id;
        $this->putJson($base.'/social-assessment', Scenario::assessment())->assertOk();
        $this->postJson($base.'/social-assessment/review', ['structured_recommendation' => 'approve'])->assertConflict();
        $this->postJson($base.'/social-assessment/submit')->assertOk();
        $this->postJson($base.'/social-assessment/submit')->assertConflict();
        $this->assertSame(1, AuditLog::where('action', 'SOCIAL_ASSESSMENT_SUBMITTED')->count());
    }

    public function test_document_scope_and_under_review_are_enforced(): void
    {
        $admin = Scenario::actor();
        Sanctum::actingAs($admin);
        $e = Scenario::evaluation($admin);
        $other = Scenario::evaluation($admin);
        $id = (string) Str::uuid();
        BeneficiaryDocument::forceCreate(['id' => $id, 'beneficiary_id' => $other->beneficiary_id, 'document_type' => 'national_id', 'file_url' => 'TEST_REF']);
        $id = BeneficiaryDocument::where('beneficiary_id', $other->beneficiary_id)->value('id');
        $base = '/api/beneficiary-policy/evaluations/'.$e->id;
        $this->postJson($base.'/documents/national_id', ['status' => 'verified', 'document_id' => $id, 'evidence_reference' => 'TEST_REF'])->assertNotFound();
        $this->postJson($base.'/documents/national_id', ['status' => 'under_review', 'evidence_reference' => 'TEST_REF'])->assertOk()->assertJsonPath('data.evaluation_id', $e->id);
        $this->getJson($base.'/review')->assertJsonPath('data.documents.1.status', 'under_review');
        $this->postJson($base.'/documents/unknown', ['status' => 'verified', 'evidence_reference' => 'TEST_REF'])->assertUnprocessable();
        $this->getJson('/api/beneficiary-policy/beneficiaries/'.$e->beneficiary_id.'/evaluations')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $e->id);
    }

    public function test_policy_exclusion_and_excess_children_cannot_be_overridden_by_decider(): void
    {
        $admin = Scenario::actor();
        Sanctum::actingAs($admin);
        $e = Scenario::evaluation($admin);
        Scenario::complete($e, $admin);
        $a = SocialAssessment::where('evaluation_id', $e->id)->firstOrFail();
        $a->update(['household_findings' => ['affected_children_count' => 4]]);
        $base = '/api/beneficiary-policy/evaluations/'.$e->id;
        $reason = ['reason_code' => 'COMPLETE', 'reason_text' => 'Claim'];
        $this->postJson($base.'/approve', $reason)->assertUnprocessable();
        $a->update(['household_findings' => ['affected_children_count' => 2]]);
        $snapshot = $e->scoring_snapshot;
        $snapshot['outcome'] = 'financially_excluded';
        $e->update(['scoring_snapshot' => $snapshot]);
        $this->postJson($base.'/approve', $reason)->assertUnprocessable();
        $this->assertSame(0, PolicyDecision::count());
    }

    public function test_untrusted_resolution_claims_and_invalid_medical_service_input_are_rejected(): void
    {
        $admin = Scenario::actor();
        $e = Scenario::evaluation($admin);
        $resolved = app(SocialAssessmentService::class)->resolveReviewReasons($e->id, ['all_evidence_complete' => true]);
        $this->assertContains('HEAD_HEALTH_REVIEW_REQUIRED', $resolved['unresolved_policy_ambiguities']);
        $this->expectException(ValidationException::class);
        app(PolicyDocumentVerificationService::class)->medical([
            'beneficiary_id' => $e->beneficiary_id, 'evaluation_id' => $e->id,
            'verification_status' => 'verified', 'verified_disability_percentage' => 100.01,
            'verified_by' => $admin->id,
        ]);
    }
}
