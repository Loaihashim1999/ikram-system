<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Beneficiary;
use App\Models\BeneficiaryPolicyEvaluation;
use App\Models\PolicyApplicationRun;
use App\Models\PolicyDecision;
use App\Services\BeneficiaryPolicy\PolicyRegistrationEvaluationService;
use App\Services\FinancialCalculationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Laravel\Sanctum\Sanctum;
use Tests\Support\PolicyEScenario;
use Tests\TestCase;

/**
 * POLICY-E4 — future-beneficiary policy application at registration.
 *
 * Proves: the explicit in-transaction registration hook evaluates a new
 * beneficiary under the applicable published version, is idempotent per
 * (beneficiary, version), treats evaluation failure as ancillary (the valid
 * registration always commits and the failure is audited) and honors the
 * canonical effective_from_date boundary with inclusive date-only semantics.
 */
class PolicyE4RegistrationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Sanctum::actingAs(PolicyEScenario::actor());
    }

    /** A payload that satisfies the production registration rules contract. */
    protected function registrationPayload(array $overrides = []): array
    {
        return array_merge([
            'reviewed_confirmation' => true,
            'full_name' => 'TEST POLICY E4 BENEFICIARY',
            'national_id' => '1'.str_pad((string) random_int(0, 999999999), 9, '0', STR_PAD_LEFT),
            'phone' => '05'.str_pad((string) random_int(0, 99999999), 8, '0', STR_PAD_LEFT),
            'beneficiary_type' => 'citizen',
            'nationality' => 'سعودي',
            'city' => 'صنعاء',
            'district' => 'حي الاختبار',
            'street' => 'شارع الاختبار',
            'date_of_birth' => '1990-05-05',
            'family_status' => 'poor',
            'family_members_count' => 3,
            'housing_type' => 'own',
            'status' => 'active',
            'income_sources' => ['salary'],
            'monthly_salary' => 700,
        ], $overrides);
    }

    protected function register(array $overrides = []): TestResponse
    {
        return $this->postJson('/api/beneficiaries', $this->registrationPayload($overrides));
    }

    // ── SCOPE COVERAGE ────────────────────────────────────────────────

    public function test_registration_without_a_published_version_still_commits_silently(): void
    {
        $response = $this->register();
        $response->assertCreated();
        $this->assertSame(1, Beneficiary::count());
        $this->assertSame(0, BeneficiaryPolicyEvaluation::count());

        $beneficiary = Beneficiary::findOrFail($response->json('data.id'));
        $this->assertNull(
            app(PolicyRegistrationEvaluationService::class)->applicableVersion($beneficiary),
            'no published version covers the registration'
        );
        $this->assertSame(0, AuditLog::where('action', PolicyRegistrationEvaluationService::AUDIT_EVALUATED)->count());
    }

    public function test_registration_creates_the_first_evaluation_when_scope_covers(): void
    {
        $actor = PolicyEScenario::actor();
        $version = PolicyEScenario::published($actor, ['application_scope' => ['applies_to' => 'all_existing_and_new']]);

        $response = $this->register();
        $response->assertCreated();
        $beneficiaryId = $response->json('data.id');

        $this->assertSame(1, BeneficiaryPolicyEvaluation::count(), 'the hook creates exactly the first evaluation');
        $evaluation = BeneficiaryPolicyEvaluation::firstOrFail();
        $this->assertSame($beneficiaryId, $evaluation->beneficiary_id);
        $this->assertSame($version->id, $evaluation->policy_version_id);
        $this->assertSame(PolicyDecision::count(), 0, 'POLICY-D stays untouched at registration');
        $this->assertSame(PolicyApplicationRun::count(), 0, 'registration never touches the run ledger');

        $audit = AuditLog::where('action', PolicyRegistrationEvaluationService::AUDIT_EVALUATED)->firstOrFail();
        $this->assertEquals($beneficiaryId, $audit->target_id);
        $this->assertSame($version->id, $audit->details['policy_version_id']);
        $this->assertSame('all_existing_and_new', $audit->details['scope_mode']);
    }

    public function test_registration_evaluation_is_idempotent_per_beneficiary_and_version(): void
    {
        $actor = PolicyEScenario::actor();
        PolicyEScenario::published($actor, ['application_scope' => ['applies_to' => 'new_only']]);

        $response = $this->register();
        $response->assertCreated();
        $beneficiary = Beneficiary::findOrFail($response->json('data.id'));
        $this->assertSame(1, BeneficiaryPolicyEvaluation::count(), 'new_only still covers future registrations');

        // Re-entry for the same (beneficiary, version) pair is a no-op.
        $service = app(PolicyRegistrationEvaluationService::class);
        $this->assertNotNull($service->applicableVersion($beneficiary));
        $this->assertNull($service->evaluateNewBeneficiary($beneficiary, $actor->id));
        $this->assertSame(1, BeneficiaryPolicyEvaluation::count(), 'no duplicate evaluation is created');
        $this->assertSame(1, AuditLog::where('action', PolicyRegistrationEvaluationService::AUDIT_EVALUATED)->count());
    }

    // ── REGISTRATION INTEGRITY ────────────────────────────────────────

    public function test_evaluation_failure_never_breaks_a_valid_registration(): void
    {
        $actor = PolicyEScenario::actor();
        PolicyEScenario::published($actor, ['application_scope' => ['applies_to' => 'all_existing_and_new']]);

        // The authoritative calculation fails during the evaluation only; the
        // legacy registration calculation (FinancialCalculationService::calculate)
        // is a separate method and keeps passing through to the real service.
        $this->partialMock(FinancialCalculationService::class, function ($mock) {
            $mock->shouldReceive('calculatePolicyFinancials')
                ->andThrow(new \RuntimeException('TEST_REGISTRATION_EVALUATION_FAILURE'));
        });

        $response = $this->register();
        $response->assertCreated();

        $beneficiaryId = $response->json('data.id');
        $this->assertSame(1, Beneficiary::count(), 'the registration transaction still commits');
        $this->assertSame(0, BeneficiaryPolicyEvaluation::count());

        $failure = AuditLog::where('action', PolicyRegistrationEvaluationService::AUDIT_FAILED)->firstOrFail();
        $this->assertEquals($beneficiaryId, $failure->target_id);
        $this->assertSame(PolicyRegistrationEvaluationService::FAILURE_CODE, $failure->details['failure_code']);
        $this->assertStringContainsString('TEST_REGISTRATION_EVALUATION_FAILURE', $failure->details['failure_details']);
    }

    // ── EFFECTIVE-FROM-DATE BOUNDARY ──────────────────────────────────

    public function test_effective_from_date_before_the_boundary_skips_the_registration(): void
    {
        $actor = PolicyEScenario::actor();
        PolicyEScenario::published($actor, [
            'application_scope' => [
                'applies_to' => 'effective_from_date',
                'effective_from_date' => now()->addDay()->toDateString(),
            ],
        ]);

        $response = $this->register();
        $response->assertCreated();
        $beneficiary = Beneficiary::findOrFail($response->json('data.id'));

        $this->assertSame(1, Beneficiary::count());
        $this->assertSame(0, BeneficiaryPolicyEvaluation::count(), 'registered before the boundary is out of scope');
        $this->assertNull(app(PolicyRegistrationEvaluationService::class)->applicableVersion($beneficiary));
        $this->assertSame(0, AuditLog::where('action', PolicyRegistrationEvaluationService::AUDIT_EVALUATED)->count());
    }

    public function test_effective_from_date_at_the_boundary_applies_inclusively(): void
    {
        $actor = PolicyEScenario::actor();
        $version = PolicyEScenario::published($actor, [
            'application_scope' => [
                'applies_to' => 'effective_from_date',
                'effective_from_date' => now()->toDateString(),
            ],
        ]);

        $response = $this->register();
        $response->assertCreated();
        $beneficiaryId = $response->json('data.id');

        $this->assertSame(1, BeneficiaryPolicyEvaluation::count(), 'the exact boundary day is inclusive (date-only)');
        $this->assertSame($version->id, BeneficiaryPolicyEvaluation::firstOrFail()->policy_version_id);

        $audit = AuditLog::where('action', PolicyRegistrationEvaluationService::AUDIT_EVALUATED)->firstOrFail();
        $this->assertEquals($beneficiaryId, $audit->target_id);
        $this->assertSame('effective_from_date', $audit->details['scope_mode']);
    }
}
