<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Beneficiary;
use App\Models\BeneficiaryPolicyEvaluation;
use App\Models\BeneficiaryPolicyVersion;
use App\Models\User;
use App\Services\BeneficiaryPolicy\PolicyApprovalService;
use App\Services\BeneficiaryPolicy\PolicyDocumentVerificationService;
use App\Services\BeneficiaryPolicy\SocialAssessmentService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\Support\PolicyDScenario;
use Tests\TestCase;

class PolicyDAuditLogTest extends TestCase
{
    use RefreshDatabase;

    protected $auditUser;

    protected function setUp(): void
    {
        parent::setUp();
        $this->auditUser = User::create([
            'username' => 'audit_user_policy_d', 'full_name' => 'Audit User',
            'email' => 'audit_policy_d@test.invalid', 'password' => Hash::make('test'),
            'is_active' => true,
        ]);
    }

    public function test_document_verification_creates_audit_log(): void
    {
        $b = Beneficiary::create([
            'beneficiary_type' => 'citizen', 'full_name' => 'مواطن تدقيق',
            'national_id' => '1'.str_pad('9', 9, '0', STR_PAD_LEFT),
            'phone' => '05'.str_pad('9', 8, '0', STR_PAD_LEFT),
            'date_of_birth' => '1985-05-05', 'status' => 'active', 'housing_type' => 'own',
            'income_sources' => ['salary'], 'monthly_salary' => 1000,
        ]);
        $service = app(PolicyDocumentVerificationService::class);
        $service->verify($b->id, 'national_id', null, ['verified_by' => $this->auditUser->id, 'verified_at' => now(), 'evidence_reference' => 'ref.pdf']);
        $log = AuditLog::where('action', 'DOCUMENT_VERIFIED')->where('target_table', 'document_verifications')->first();
        $this->assertNotNull($log);
        $this->assertSame($this->auditUser->id, $log->user_id);
        $this->assertArrayNotHasKey('iban', $log->details ?? []);
    }

    public function test_social_assessment_creates_audit_log(): void
    {
        $b = Beneficiary::create([
            'beneficiary_type' => 'citizen', 'full_name' => 'مواطن تدقيق 2',
            'national_id' => '2'.str_pad('8', 9, '0', STR_PAD_LEFT),
            'phone' => '05'.str_pad('8', 8, '0', STR_PAD_LEFT),
            'date_of_birth' => '1980-05-05', 'status' => 'active', 'housing_type' => 'own',
            'income_sources' => ['salary'], 'monthly_salary' => 1000,
        ]);
        $service = app(SocialAssessmentService::class);
        $assessment = $service->create([
            'beneficiary_id' => $b->id,
            'assessment_date' => now()->format('Y-m-d'),
            'housing_condition' => 'average',
            'structured_recommendation' => 'pending_review',
            'status' => 'draft',
            'created_by' => $this->auditUser->id,
        ]);
        $log = AuditLog::where('action', 'SOCIAL_ASSESSMENT_CREATED')->first();
        $this->assertNotNull($log);
        $this->assertSame($this->auditUser->id, $log->user_id);
        $this->assertArrayNotHasKey('national_id', $log->details ?? []);
    }

    public function test_policy_approval_creates_audit_log(): void
    {
        $b = Beneficiary::create([
            'beneficiary_type' => 'citizen', 'full_name' => 'مواطن تدقيق 3',
            'national_id' => '3'.str_pad('7', 9, '0', STR_PAD_LEFT),
            'phone' => '05'.str_pad('7', 8, '0', STR_PAD_LEFT),
            'date_of_birth' => '1990-05-05', 'status' => 'active', 'housing_type' => 'own',
            'income_sources' => ['salary'], 'monthly_salary' => 1000,
        ]);
        $version = BeneficiaryPolicyVersion::create([
            'policy_name' => 'اختبار', 'version' => 'v-audit-test',
            'policy_scope' => 'citizen_beneficiaries', 'effective_from' => '2026-01-01', 'status' => 'draft',
        ]);
        $eval = BeneficiaryPolicyEvaluation::create([
            'beneficiary_id' => $b->id, 'policy_version_id' => $version->id,
            'status' => 'completed', 'evaluation_status' => 'completed', 'eligibility_decision' => 'eligible',
        ]);
        $eval->update(['financial_snapshot' => ['net_income_per_capita' => 400], 'scoring_snapshot' => ['reviews' => [], 'outcome' => 'financially_qualified']]);
        PolicyDScenario::complete($eval, User::findOrFail($this->auditUser->id));
        $approvalService = app(PolicyApprovalService::class);
        $approvalService->approve($eval->id, $version->id, $this->auditUser->id, [
            'reason_code' => 'DOCUMENTARY_EVIDENCE_COMPLETE',
            'reason_text' => 'مكتمل',
            'evidence_summary' => ['document_verifications' => ['verified']],
        ]);
        $log = AuditLog::where('action', 'POLICY_DECISION_APPROVED')->first();
        $this->assertNotNull($log);
        $this->assertSame($this->auditUser->id, $log->user_id);
        $this->assertSame('policy_decisions', $log->target_table);
    }
}
