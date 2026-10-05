<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Beneficiary;
use App\Models\BeneficiaryPolicyEvaluation;
use App\Models\BeneficiaryPolicyVersion;
use App\Models\User;
use App\Services\BeneficiaryPolicy\BeneficiaryPolicyEvaluationService;
use App\Services\BeneficiaryPolicy\BeneficiaryPolicyVersionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class BeneficiaryPolicyEngineTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        config(['app.key' => 'base64:'.base64_encode(str_repeat('T', 32))]);
        $this->admin = User::create([
            'username' => 'TEST_POLICY_ADMIN', 'full_name' => 'Policy Admin', 'password' => 'test-password',
            'email' => 'policy@example.invalid', 'role' => 'admin', 'is_active' => true,
        ]);
        Sanctum::actingAs($this->admin);
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    protected function draftPayload(array $overrides = []): array
    {
        return array_merge([
            'policy_name' => 'سياسة صرف المساعدات للمستفيدين',
            'version' => '1',
            'policy_scope' => 'citizen_beneficiaries',
            'effective_from' => '2026-10-01',
            'effective_to' => null,
            'source_document_reference' => 'سياسة صرف المساعدات — نسخة 4',
            'source_document_version' => '4',
            'configuration' => [
                'financial' => ['per_family_member_deduction' => 100, 'counted_income_sources' => ['salary', 'social_security', 'citizen_account']],
                'application_scope' => ['applies_to' => 'new_only'],
            ],
        ], $overrides);
    }

    protected function createDraft(array $overrides = []): BeneficiaryPolicyVersion
    {
        return app(BeneficiaryPolicyVersionService::class)->createDraft($this->draftPayload($overrides), $this->admin->id);
    }

    protected function publishVersion(array $overrides = []): BeneficiaryPolicyVersion
    {
        $service = app(BeneficiaryPolicyVersionService::class);
        $draft = $service->createDraft($this->draftPayload($overrides), $this->admin->id);
        $draft = $service->approve($draft->id, ['board_approval_reference' => 'قرار 1/2026', 'board_approval_date' => '2026-09-20'], $this->admin->id);

        return $service->publish($draft->id, $this->admin->id);
    }

    protected function beneficiary(array $overrides = []): Beneficiary
    {
        return Beneficiary::create(array_merge([
            'full_name' => 'مستفيد اختبار', 'national_id' => '1100110011', 'phone' => '0550000000',
        ], $overrides));
    }

    protected function permissionUser(array $perms, string $role = 'assistant_admin'): User
    {
        $user = User::create([
            'username' => 'TEST_POLICY_'.strtoupper(substr(md5(uniqid('', true)), 0, 8)),
            'full_name' => 'Policy User', 'password' => 'test-password',
            'email' => 'policy-user@example.invalid', 'role' => $role,
            'permissions' => ['beneficiary_policy' => $perms], 'is_active' => true,
        ]);
        Sanctum::actingAs($user);

        return $user;
    }

    protected function assertAudit(string $action, string $targetId): void
    {
        $this->assertDatabaseHas('audit_logs', ['action' => $action, 'target_table' => 'beneficiary_policy_versions', 'target_id' => $targetId]);
    }

    // ── 1. Create draft ────────────────────────────────────────────────────

    public function test_create_draft_via_api(): void
    {
        $response = $this->postJson('/api/beneficiary-policy/versions', $this->draftPayload())->assertCreated();

        $this->assertDatabaseHas('beneficiary_policy_versions', ['version' => '1', 'status' => 'draft']);
        $this->assertAudit('POLICY_DRAFT_CREATED', $response->json('data.id'));
        $config = BeneficiaryPolicyVersion::find($response->json('data.id'))->configuration;
        $this->assertSame([100, ['salary', 'social_security', 'citizen_account']], [$config['financial']['per_family_member_deduction'], $config['financial']['counted_income_sources']]);
    }

    // ── 2. Edit draft ──────────────────────────────────────────────────────

    public function test_edit_draft_updates_metadata_and_config(): void
    {
        $draft = $this->createDraft();

        $this->patchJson('/api/beneficiary-policy/versions/'.$draft->id, [
            'effective_from' => '2026-11-01',
            'source_document_version' => '4.1',
            'configuration' => $this->draftPayload()['configuration'],
        ])->assertOk();

        $fresh = $draft->fresh();
        $this->assertSame('2026-11-01', $fresh->effective_from->format('Y-m-d'));
        $this->assertSame('4.1', $fresh->source_document_version);
        $this->assertAudit('POLICY_DRAFT_UPDATED', $draft->id);
    }

    // ── 3. Publish flow ────────────────────────────────────────────────────

    public function test_full_lifecycle_publish_via_api(): void
    {
        $draft = $this->createDraft();

        $this->postJson('/api/beneficiary-policy/versions/'.$draft->id.'/approve', [
            'board_approval_reference' => 'قرار 1/2026',
            'board_approval_date' => '2026-09-20',
        ])->assertOk();

        $approved = $draft->fresh();
        $this->assertSame('draft', $approved->status);
        $this->assertSame($this->admin->id, $approved->approved_by);
        $this->assertAudit('POLICY_APPROVED', $draft->id);

        $this->postJson('/api/beneficiary-policy/versions/'.$draft->id.'/publish')->assertOk();

        $published = $approved->fresh();
        $this->assertSame('published', $published->status);
        $this->assertSame($this->admin->id, $published->published_by);
        $this->assertNotNull($published->published_at);
        $this->assertAudit('POLICY_PUBLISHED', $draft->id);
    }

    // ── 4. Published policy immutable ─────────────────────────────────────

    public function test_published_policy_is_immutable(): void
    {
        $published = $this->publishVersion();
        $this->patchJson('/api/beneficiary-policy/versions/'.$published->id, ['effective_from' => '2027-01-01'])->assertStatus(409);

        $this->postJson('/api/beneficiary-policy/versions/'.$published->id.'/retire', ['change_reason' => 'استبدال السياسة'])->assertOk();
        $this->patchJson('/api/beneficiary-policy/versions/'.$published->id, ['policy_name' => 'محاولة تعديل'])->assertStatus(409);
        $this->assertSame('2026-10-01', $published->fresh()->effective_from->format('Y-m-d'));
    }

    // ── 5. Clone preserves previous version ───────────────────────────────

    public function test_clone_preserves_previous_version(): void
    {
        $published = $this->publishVersion();

        $response = $this->postJson('/api/beneficiary-policy/versions/'.$published->id.'/clone')->assertCreated();

        $clone = BeneficiaryPolicyVersion::find($response->json('data.id'));
        $this->assertSame('2', $clone->version);
        $this->assertSame($published->id, $clone->parent_version_id);
        $this->assertSame('draft', $clone->status);
        $this->assertSame($published->configuration, $clone->configuration);
        $this->assertSame('published', $published->fresh()->status);
        $this->assertAudit('POLICY_DRAFT_CREATED', $clone->id);
    }

    // ── 6. Retire ─────────────────────────────────────────────────────────

    public function test_retire_published_policy(): void
    {
        $published = $this->publishVersion();

        $this->postJson('/api/beneficiary-policy/versions/'.$published->id.'/retire', ['change_reason' => 'اعتماد سياسة محدثة'])->assertOk();

        $retired = $published->fresh();
        $this->assertSame('retired', $retired->status);
        $this->assertSame($this->admin->id, $retired->retired_by);
        $this->assertNotNull($retired->retired_at);
        $this->assertAudit('POLICY_RETIRED', $published->id);
    }

    // ── 7. Invalid status transitions rejected ────────────────────────────

    public function test_invalid_status_transitions_rejected(): void
    {
        $draft = $this->createDraft();

        // publish without approval → rejected
        $this->postJson('/api/beneficiary-policy/versions/'.$draft->id.'/publish')->assertStatus(409);
        // duplicate version number → rejected
        $this->postJson('/api/beneficiary-policy/versions', $this->draftPayload())->assertUnprocessable();
        // approve published → rejected
        $published = $this->publishVersion(['version' => '2', 'effective_from' => '2027-01-01']);
        $this->postJson('/api/beneficiary-policy/versions/'.$published->id.'/approve', [
            'board_approval_reference' => 'قرار', 'board_approval_date' => '2026-09-21',
        ])->assertStatus(409);
        // retire draft → rejected
        $this->postJson('/api/beneficiary-policy/versions/'.$draft->id.'/retire', ['change_reason' => 'سبب'])->assertStatus(409);
        // publish retired → rejected
        $this->postJson('/api/beneficiary-policy/versions/'.$published->id.'/retire', ['change_reason' => 'أرشفة'])->assertOk();
        $this->postJson('/api/beneficiary-policy/versions/'.$published->id.'/publish')->assertStatus(409);
    }

    // ── 8. One-active rule: overlapping effective periods ─────────────────

    public function test_overlapping_published_policies_rejected(): void
    {
        $this->publishVersion(['version' => '1', 'effective_from' => '2026-01-01', 'effective_to' => '2026-12-31']);

        // overlapping new policy → rejected
        $this->postJson('/api/beneficiary-policy/versions', $this->draftPayload([
            'version' => '2', 'effective_from' => '2026-06-01', 'effective_to' => null,
        ]))->assertCreated();
        $overlap = BeneficiaryPolicyVersion::where('version', '2')->first();
        $this->postJson('/api/beneficiary-policy/versions/'.$overlap->id.'/approve', [
            'board_approval_reference' => 'قرار', 'board_approval_date' => '2026-09-20',
        ])->assertOk();
        $this->postJson('/api/beneficiary-policy/versions/'.$overlap->id.'/publish')->assertStatus(409);
        $this->assertSame('draft', $overlap->fresh()->status);

        // sequential (non-overlapping) future policy → allowed
        $this->postJson('/api/beneficiary-policy/versions', $this->draftPayload([
            'version' => '3', 'effective_from' => '2027-01-01', 'effective_to' => null,
        ]))->assertCreated();
        $future = BeneficiaryPolicyVersion::where('version', '3')->first();
        $this->postJson('/api/beneficiary-policy/versions/'.$future->id.'/approve', [
            'board_approval_reference' => 'قرار', 'board_approval_date' => '2026-09-20',
        ])->assertOk();
        $this->postJson('/api/beneficiary-policy/versions/'.$future->id.'/publish')->assertOk();
        $this->assertSame('published', $future->fresh()->status);
        $this->assertSame('published', BeneficiaryPolicyVersion::where('version', '1')->first()->status);
    }

    // ── 9. Historical policy preserved ────────────────────────────────────

    public function test_historical_policy_preserved_after_supercession(): void
    {
        $v1 = $this->publishVersion(['version' => '1', 'effective_from' => '2026-01-01']);
        $b = $this->beneficiary();

        // evaluation recorded while v1 is the active published policy
        app(BeneficiaryPolicyEvaluationService::class)->create([
            'beneficiary_id' => $b->id, 'policy_version_id' => $v1->id,
            'final_policy_decision' => 'eligible', 'net_income_per_capita' => 500,
        ], $this->admin->id);

        $this->postJson('/api/beneficiary-policy/versions/'.$v1->id.'/retire', ['change_reason' => 'استبدال'])->assertOk();
        $v2 = $this->publishVersion(['version' => '2', 'effective_from' => '2026-02-01']);

        $v1Fresh = $v1->fresh();
        $this->assertSame('retired', $v1Fresh->status);
        $this->assertSame('2026-01-01', $v1Fresh->effective_from->format('Y-m-d'));
        $this->assertSame(['salary', 'social_security', 'citizen_account'], $v1Fresh->configuration['financial']['counted_income_sources']);

        // evaluations on the old version remain intact after retirement & supercession.
        $this->assertSame(1, BeneficiaryPolicyEvaluation::where('policy_version_id', $v1->id)->count());
        $this->assertSame('eligible', BeneficiaryPolicyEvaluation::where('policy_version_id', $v1->id)->first()->final_policy_decision);
        $this->assertSame('published', $v2->status);
    }

    // ── 10. Create evaluation snapshot ────────────────────────────────────

    public function test_create_evaluation_snapshot(): void
    {
        $version = $this->publishVersion();
        $b = $this->beneficiary();

        $evaluation = app(BeneficiaryPolicyEvaluationService::class)->create([
            'beneficiary_id' => $b->id,
            'policy_version_id' => $version->id,
            'evaluation_status' => 'completed',
            'gross_counted_income' => 4800,
            'monthly_rent' => 800,
            'family_size' => 5,
            'family_member_deduction' => 100,
            'adjusted_net_household_income' => 3500,
            'net_income_per_capita' => 700,
            'income_category' => 'low',
            'policy_score' => 12.5,
            'score_category' => 'a',
            'degree_classification_snapshot' => ['degree' => 'second_class', 'computed_by' => 'FinancialCalculationService'],
            'need_level_snapshot' => null,
            'final_policy_decision' => 'eligible',
            'decision_reason' => 'دخل الفرد تحت الحد الأدنى',
        ], $this->admin->id);

        $this->assertDatabaseHas('beneficiary_policy_evaluations', [
            'id' => $evaluation->id, 'beneficiary_id' => $b->id, 'policy_version_id' => $version->id,
            'income_category' => 'low', 'score_category' => 'a', 'final_policy_decision' => 'eligible',
        ]);
        $this->assertSame('second_class', $evaluation->degree_classification_snapshot['degree']);
    }

    // ── 11. Second evaluation does not overwrite ─────────────────────────

    public function test_second_evaluation_does_not_overwrite_first(): void
    {
        $version = $this->publishVersion();
        $b = $this->beneficiary();
        $service = app(BeneficiaryPolicyEvaluationService::class);

        $first = $service->create(['beneficiary_id' => $b->id, 'policy_version_id' => $version->id, 'net_income_per_capita' => 700, 'final_policy_decision' => 'eligible'], $this->admin->id);
        $second = $service->create(['beneficiary_id' => $b->id, 'policy_version_id' => $version->id, 'net_income_per_capita' => 900, 'final_policy_decision' => 'review'], $this->admin->id);

        $this->assertNotSame($first->id, $second->id);
        $this->assertCount(2, BeneficiaryPolicyEvaluation::where('beneficiary_id', $b->id)->get());
        $this->assertSame('eligible', BeneficiaryPolicyEvaluation::find($first->id)->final_policy_decision);
        $this->assertSame('review', BeneficiaryPolicyEvaluation::find($second->id)->final_policy_decision);
    }

    // ── 12. Beneficiary update does not mutate prior evaluation ──────────

    public function test_beneficiary_update_does_not_mutate_prior_evaluation(): void
    {
        $version = $this->publishVersion();
        $b = $this->beneficiary(['monthly_salary' => 2000]);
        $service = app(BeneficiaryPolicyEvaluationService::class);
        $evaluation = $service->create(['beneficiary_id' => $b->id, 'policy_version_id' => $version->id, 'net_income_per_capita' => 400, 'input_snapshot' => ['monthly_salary' => 2000]], $this->admin->id);

        $b->update(['monthly_salary' => 6000, 'citizen_account_amount' => 1000]);

        $fresh = BeneficiaryPolicyEvaluation::find($evaluation->id);
        $this->assertSame('400.00', (string) $fresh->net_income_per_capita);
        $this->assertSame(2000, $fresh->input_snapshot['monthly_salary']);
        $this->assertCount(1, BeneficiaryPolicyEvaluation::where('beneficiary_id', $b->id)->get());
    }

    // ── 13. Policy change does not mutate prior evaluation ───────────────

    public function test_policy_change_does_not_mutate_prior_evaluation(): void
    {
        $v1 = $this->publishVersion(['version' => '1', 'effective_from' => '2026-01-01', 'effective_to' => '2026-06-30']);
        $b = $this->beneficiary();
        $service = app(BeneficiaryPolicyEvaluationService::class);
        $evaluation = $service->create(['beneficiary_id' => $b->id, 'policy_version_id' => $v1->id, 'score_category' => 'b'], $this->admin->id);

        $v2 = $this->publishVersion(['version' => '2', 'effective_from' => '2026-07-01', 'configuration' => [
            'financial' => ['per_family_member_deduction' => 150, 'counted_income_sources' => ['salary']],
        ]]);
        $this->assertNotSame($v1->id, $v2->id);

        $fresh = BeneficiaryPolicyEvaluation::find($evaluation->id);
        $this->assertSame('b', $fresh->score_category);
        $this->assertSame($v1->id, $fresh->policy_version_id);
    }

    // ── 14. Classification snapshots stored separately ───────────────────

    public function test_classification_snapshots_preserved_separately(): void
    {
        $version = $this->publishVersion();
        $b = $this->beneficiary(['beneficiary_type' => 'resident']);

        $evaluation = app(BeneficiaryPolicyEvaluationService::class)->create([
            'beneficiary_id' => $b->id,
            'policy_version_id' => $version->id,
            'income_category' => 'low',              // policy income category (new result)
            'score_category' => 'a',                 // policy score category (new result)
            'degree_classification_snapshot' => ['degree' => 'second_class', 'source' => 'financial_engine'], // historical Degree
            'need_level_snapshot' => ['need_level' => 'normal_need'],                                          // historical Need
        ], $this->admin->id);

        $fresh = BeneficiaryPolicyEvaluation::find($evaluation->id);
        $this->assertSame('low', $fresh->income_category);
        $this->assertSame('a', $fresh->score_category);
        $this->assertSame('second_class', $fresh->degree_classification_snapshot['degree']);
        $this->assertSame('normal_need', $fresh->need_level_snapshot['need_level']);
    }

    // ── 15. Resident historical fields remain untouched ──────────────────

    public function test_resident_fields_remain_untouched(): void
    {
        $resident = $this->beneficiary(['beneficiary_type' => 'resident', 'income_sources' => ['salary', 'family_support'], 'monthly_salary' => 1500, 'family_support' => 500]);

        // Degree classification: resident is always second class (unchanged behavior).
        $this->assertSame('second_class', $resident->fresh()->priority);
        // Need level stays on the resident accessor path.
        $this->assertNotNull($resident->fresh()->need_level);
        // No policy evaluation was created implicitly.
        $this->assertDatabaseCount('beneficiary_policy_evaluations', 0);
        // No citizen policy value touched resident income behavior.
        $this->assertSame(2000.0, (float) $resident->fresh()->total_income);
    }

    // ── 16. Application scope values validated ───────────────────────────

    public function test_application_scope_values_validated(): void
    {
        $this->postJson('/api/beneficiary-policy/versions', $this->draftPayload([
            'configuration' => ['application_scope' => ['applies_to' => 'not_a_scope']],
        ]))->assertUnprocessable();

        foreach (['new_only', 'all_existing_and_new', 'selected_existing_and_new', 'effective_from_date'] as $scope) {
            // POLICY-E1: effective_from_date mode requires its canonical date.
            $scopeConfig = ['applies_to' => $scope]
                + ($scope === 'effective_from_date' ? ['effective_from_date' => '2026-01-01'] : []);
            $this->postJson('/api/beneficiary-policy/versions', $this->draftPayload([
                'version' => $scope, 'configuration' => ['application_scope' => $scopeConfig],
            ]))->assertCreated();
        }
    }

    // ── 17. Policy audit recorded ────────────────────────────────────────

    public function test_policy_audit_recorded(): void
    {
        $draft = $this->createDraft();
        $this->postJson('/api/beneficiary-policy/versions/'.$draft->id.'/approve', ['board_approval_reference' => 'قرار 2/2026', 'board_approval_date' => '2026-09-20'])->assertOk();
        $this->postJson('/api/beneficiary-policy/versions/'.$draft->id.'/publish')->assertOk();
        $this->postJson('/api/beneficiary-policy/versions/'.$draft->id.'/retire', ['change_reason' => 'انتهاء موسم'])->assertOk();

        // PostgreSQL CURRENT_TIMESTAMP is shared within a transaction; equal
        // timestamps do not define audit ordering. Verify every event exactly once.
        $actions = AuditLog::where('target_table', 'beneficiary_policy_versions')->where('target_id', $draft->id)->orderBy('action')->pluck('action')->all();
        $this->assertSame(['POLICY_APPROVED', 'POLICY_DRAFT_CREATED', 'POLICY_PUBLISHED', 'POLICY_RETIRED'], $actions);
    }

    // ── 18. Unauthorized user denied ─────────────────────────────────────

    public function test_unauthorized_user_denied(): void
    {
        $this->publishVersion();
        $viewer = $this->permissionUser(['view' => true, 'edit_draft' => false, 'approve' => false, 'publish' => false, 'retire' => false]);
        Sanctum::actingAs($viewer);

        $this->getJson('/api/beneficiary-policy/versions')->assertOk();
        $this->postJson('/api/beneficiary-policy/versions', $this->draftPayload(['version' => '99']))->assertForbidden();

        // A user with no beneficiary_policy permissions at all is denied.
        $none = User::create(['username' => 'TEST_POLICY_NONE', 'full_name' => 'None', 'password' => 'test-password', 'email' => 'none@example.invalid', 'role' => 'assistant_admin', 'permissions' => [], 'is_active' => true]);
        Sanctum::actingAs($none);
        $this->getJson('/api/beneficiary-policy/versions')->assertForbidden();
    }

    // ── 19. Approve permission independent from edit ─────────────────────

    public function test_approve_permission_independent_from_edit(): void
    {
        $editor = $this->permissionUser(['view' => true, 'edit_draft' => true, 'approve' => false, 'publish' => false, 'retire' => false]);
        $draft = $this->createDraft();
        Sanctum::actingAs($editor);

        $this->patchJson('/api/beneficiary-policy/versions/'.$draft->id, ['change_reason' => 'تعديل مسموح'])->assertOk();
        $this->postJson('/api/beneficiary-policy/versions/'.$draft->id.'/approve', ['board_approval_reference' => 'قرار', 'board_approval_date' => '2026-09-21'])->assertForbidden();
    }

    // ── 20. Publish permission independent ───────────────────────────────

    public function test_publish_permission_independent(): void
    {
        $approver = $this->permissionUser(['view' => true, 'edit_draft' => true, 'approve' => true, 'publish' => false, 'retire' => false]);
        $draft = $this->createDraft();
        $this->postJson('/api/beneficiary-policy/versions/'.$draft->id.'/approve', ['board_approval_reference' => 'قرار', 'board_approval_date' => '2026-09-20'])->assertOk();
        Sanctum::actingAs($approver);

        $this->postJson('/api/beneficiary-policy/versions/'.$draft->id.'/publish')->assertForbidden();
    }

    // ── 22. Rollback safety (runs in the isolated PostgreSQL QA suite) ───

    public function test_rollback_drops_and_recreates_policy_tables(): void
    {
        if (Schema::getConnection()->getDriverName() !== 'pgsql') {
            $this->markTestSkipped('Rollback probe is executed in the isolated PostgreSQL QA suite.');
        }
        $this->assertTrue(Schema::hasTable('beneficiary_policy_versions'));
        $this->assertTrue(Schema::hasTable('beneficiary_policy_evaluations'));

        $migrations = DB::table('migrations')->orderByDesc('batch')->orderByDesc('migration')->pluck('migration');
        $foundation = $migrations->search('2026_09_21_010000_create_beneficiary_policy_architecture');
        $this->assertNotFalse($foundation, 'Policy foundation migration must be recorded.');
        $transactionLevel = DB::transactionLevel();
        $this->assertGreaterThan(0, $transactionLevel, 'Rollback probe requires the test transaction.');

        // Include every newer dependent migration, regardless of how many were added.
        // A PostgreSQL savepoint restores the schema even when the probe fails.
        DB::transaction(function () use ($foundation, $migrations): void {
            $this->assertSame(0, Artisan::call('migrate:rollback', ['--step' => $foundation + 1]));
            $this->assertFalse(Schema::hasTable('beneficiary_policy_versions'));
            $this->assertFalse(Schema::hasTable('beneficiary_policy_evaluations'));

            $this->assertSame(0, Artisan::call('migrate'));
            $this->assertTrue(Schema::hasTable('beneficiary_policy_versions'));
            $this->assertTrue(Schema::hasTable('beneficiary_policy_evaluations'));
            $this->assertSame($migrations->sort()->values()->all(), DB::table('migrations')->pluck('migration')->sort()->values()->all());
        });
        $this->assertSame($transactionLevel, DB::transactionLevel());
    }
}
