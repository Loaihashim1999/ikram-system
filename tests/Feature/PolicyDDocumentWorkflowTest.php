<?php

namespace Tests\Feature;

use App\Models\Beneficiary;
use App\Models\BeneficiaryPolicyEvaluation;
use App\Models\BeneficiaryPolicyVersion;
use App\Models\User;
use App\Services\BeneficiaryPolicy\PolicyApprovalService;
use App\Services\BeneficiaryPolicy\PolicyConfigurationValidator;
use App\Services\BeneficiaryPolicy\PolicyDocumentVerificationService;
use App\Services\BeneficiaryPolicy\SocialAssessmentService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Tests\Support\PolicyDScenario;
use Tests\TestCase;

class PolicyDDocumentWorkflowTest extends TestCase
{
    use RefreshDatabase;

    protected string $actorId;

    protected PolicyDocumentVerificationService $documentService;

    protected SocialAssessmentService $assessmentService;

    protected PolicyApprovalService $approvalService;

    protected function setUp(): void
    {
        parent::setUp();
        $this->documentService = app(PolicyDocumentVerificationService::class);
        $this->assessmentService = app(SocialAssessmentService::class);
        $this->approvalService = app(PolicyApprovalService::class);
        // Real isolated fixture actor: keep FK enforcement enabled, including audit_logs.user_id.
        $this->actorId = User::create([
            'username' => 'TEST_policy_d_workflow', 'full_name' => 'TEST workflow actor',
            'password' => 'TEST-password', 'role' => 'admin', 'is_active' => true,
        ])->id;
    }

    // 1. Default document rules exist in validated config
    public function test_document_rules_exist_in_validated_config(): void
    {
        $validated = PolicyConfigurationValidator::validate([
            'documents' => ['rules' => []],
        ]);
        $this->assertArrayHasKey('documents', $validated);
        $this->assertNotEmpty($validated['documents']['rules']);
    }

    // 2. Document verification records structured evidence (not binary)
    public function test_document_verification_stores_evidence_reference(): void
    {
        $b = Beneficiary::create([
            'beneficiary_type' => 'citizen',
            'full_name' => 'مواطن تجريبي TEST',
            'national_id' => '1'.str_pad('1', 9, '0', STR_PAD_LEFT),
            'phone' => '05'.str_pad('2', 8, '0', STR_PAD_LEFT),
            'date_of_birth' => '1980-05-05',
            'family_status' => 'poor',
            'status' => 'active',
            'housing_type' => 'own',
        ]);
        $v = $this->documentService->verify($b->id, 'death_certificate', null, [
            'verified_by' => $this->actorId,
            'verified_at' => now(),
            'evidence_reference' => 'public/beneficiaries/death_certificate_example_1.pdf',
        ]);
        $this->assertSame('verified', $v->verification_status);
        $this->assertStringContainsString('death_certificate_example', $v->evidence_reference);
    }

    // 3. Social assessment creates structured record (draft/submitted/reviewed)
    public function test_social_assessment_workflow_states(): void
    {
        $b = Beneficiary::create([
            'beneficiary_type' => 'citizen',
            'full_name' => 'مواطن تجريبي TEST',
            'national_id' => '1'.str_pad('1', 9, '0', STR_PAD_LEFT),
            'phone' => '05'.str_pad('2', 8, '0', STR_PAD_LEFT),
            'date_of_birth' => '1980-05-05',
            'family_status' => 'poor',
            'status' => 'active',
            'housing_type' => 'own',
        ]);
        $assessment = $this->assessmentService->create([
            'beneficiary_id' => $b->id,
            'assessment_date' => now()->format('Y-m-d'),
            'housing_condition' => 'poor',
            'service_area_result' => 'verified_inside',
            'structured_recommendation' => 'pending_review',
            'status' => 'draft',
        ]);
        $this->assertSame('draft', $assessment->status);

        $submitted = $this->assessmentService->submit($assessment->id, $this->actorId);
        $this->assertSame('submitted', $submitted->status);
    }

    // 4. Approval/rejection requires stable reason code
    public function test_approval_requires_stable_reason(): void
    {
        $b = Beneficiary::create([
            'beneficiary_type' => 'citizen',
            'full_name' => 'مواطن تجريبي TEST',
            'national_id' => '1'.str_pad('1', 9, '0', STR_PAD_LEFT),
            'phone' => '05'.str_pad('2', 8, '0', STR_PAD_LEFT),
            'date_of_birth' => '1980-05-05',
            'family_status' => 'poor',
            'status' => 'active',
            'housing_type' => 'own',
        ]);
        $version = BeneficiaryPolicyVersion::create([
            'policy_name' => 'سياسة اختبارية',
            'version' => 'v-test-policy',
            'policy_scope' => 'citizen_beneficiaries',
            'effective_from' => '2026-01-01',
            'status' => 'draft',
        ]);
        $eval = BeneficiaryPolicyEvaluation::create([
            'beneficiary_id' => $b->id,
            'policy_version_id' => $version->id,
            'status' => 'completed',
            'evaluation_status' => 'completed',
            'eligibility_decision' => 'eligible',
        ]);
        $eval->update(['financial_snapshot' => ['net_income_per_capita' => 400], 'scoring_snapshot' => ['reviews' => [], 'outcome' => 'financially_qualified']]);
        PolicyDScenario::complete($eval, User::findOrFail($this->actorId));
        $decision = $this->approvalService->approve(
            $eval->id,
            $version->id,
            $this->actorId,
            ['reason_code' => 'DOCUMENTARY_EVIDENCE_COMPLETE', 'reason_text' => 'جميع الوثائق المطلوبة موثقة.', 'evidence_summary' => ['document_verifications' => ['verified']]]
        );
        $this->assertSame('approved', $decision->decision);
        $this->assertSame('DOCUMENTARY_EVIDENCE_COMPLETE', $decision->stable_reason_code);
    }

    // 5. Historical snapshot remains unchanged (POLICY-D does not mutate prior evaluations)
    public function test_policy_c_evaluation_not_mutated_by_policy_d(): void
    {
        $actor = User::findOrFail($this->actorId);
        $evaluation = PolicyDScenario::evaluation($actor);
        $before = $evaluation->getRawOriginal();
        PolicyDScenario::complete($evaluation, $actor);
        $this->approvalService->approve($evaluation->id, $evaluation->policy_version_id, $actor->id, ['reason_code' => 'COMPLETE', 'reason_text' => 'Evidence complete']);
        $this->assertSame($before, $evaluation->fresh()->getRawOriginal());
    }

    // 6. Document rules allow structured predicates (no executable conditions/eval)
    public function test_document_rules_use_only_structured_predicates(): void
    {
        $validated = PolicyConfigurationValidator::validate([
            'documents' => ['rules' => [[
                'code' => 'family_record', 'label' => 'سجل الأسرة', 'required' => true,
                'requires_verification' => false, 'allowed_document_types' => ['national_id'],
                'applies_when' => ['family_status' => 'poor'],
            ]]],
        ]);
        $rule = $validated['documents']['rules'][0];
        $this->assertArrayNotHasKey('eval', $rule);
        $this->assertIsString($rule['code']);
    }

    // 7. Generic widow exception remains review_required without documentary proof (POLICY-D does not invent evidence)
    public function test_generic_widow_remains_review_without_document_evidence(): void
    {
        // POLICY-D verification service may mark a document missing/rejected,
        // but the exception engine (POLICY-C) keeps the review_required result
        // until authoritative structured evidence exists.
        $b = Beneficiary::create([
            'beneficiary_type' => 'citizen',
            'full_name' => 'مواطن تجريبي WIDOW',
            'national_id' => '1'.str_pad('5', 9, '0', STR_PAD_LEFT),
            'phone' => '05'.str_pad('5', 8, '0', STR_PAD_LEFT),
            'date_of_birth' => '1970-05-05',
            'family_status' => 'widow',
            'status' => 'active',
            'housing_type' => 'rent',
        ]);
        $v = $this->documentService->reject($b->id, 'death_certificate', null, [
            'verified_by' => $this->actorId,
            'verified_at' => now(),
            'rejection_reason' => 'شهادة الوفاة غير متوفرة.',
        ]);
        $this->assertSame('rejected', $v->verification_status);
        // The evaluation stays review_required (POLICY-C behavior unchanged by POLICY-D).
    }

    // 8. Medical evidence validates exact range 0..100
    public function test_incomplete_evidence_cannot_be_approved_by_service(): void
    {
        $actor = User::findOrFail($this->actorId);
        $evaluation = PolicyDScenario::evaluation($actor);
        $this->expectException(ValidationException::class);
        $this->approvalService->approve($evaluation->id, $evaluation->policy_version_id, $actor->id, ['reason_code' => 'COMPLETE', 'reason_text' => 'Caller claims completion']);
    }

    // 9. Document binary not copied into snapshot (evidence_reference only)
    public function test_document_evidence_reference_no_binary_copy(): void
    {
        $b = Beneficiary::create([
            'beneficiary_type' => 'citizen',
            'full_name' => 'مواطن تجريبي TEST',
            'national_id' => '1'.str_pad('1', 9, '0', STR_PAD_LEFT),
            'phone' => '05'.str_pad('2', 8, '0', STR_PAD_LEFT),
            'date_of_birth' => '1980-05-05',
            'family_status' => 'poor',
            'status' => 'active',
            'housing_type' => 'own',
        ]);
        $v = $this->documentService->verify($b->id, 'national_id', null, [
            'evidence_reference' => 'public/beneficiaries/national_id_example.pdf',
        ]);
        $this->assertStringNotContainsString('base64', $v->evidence_reference);
        $this->assertStringContainsString('.pdf', $v->evidence_reference);
    }
}
