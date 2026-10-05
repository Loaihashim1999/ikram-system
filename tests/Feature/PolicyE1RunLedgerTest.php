<?php

namespace Tests\Feature;

use App\Models\Beneficiary;
use App\Models\BeneficiaryPolicyEvaluation;
use App\Models\BeneficiaryPolicyVersion;
use App\Models\PolicyApplicationRun;
use App\Models\PolicyApplicationRunItem;
use App\Models\PolicyDecision;
use App\Models\User;
use App\Services\BeneficiaryPolicy\BeneficiaryPolicyVersionService;
use App\Services\BeneficiaryPolicy\PolicyApplicationRunService;
use App\Services\BeneficiaryPolicy\PolicyApplicationScopeService;
use App\Services\BeneficiaryPolicy\PolicyApplicationSimulationService;
use App\Services\BeneficiaryPolicy\PolicyConfigurationValidator;
use App\Services\BeneficiaryPolicy\PolicyFinancialEvaluationService;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * POLICY-E1 — application-scope contract, run ledger, state machine,
 * fingerprint determinism, permission contract, history isolation.
 * No simulation (E2), no execution (E3), no registration hooks (E4).
 */
class PolicyE1RunLedgerTest extends TestCase
{
    use RefreshDatabase;

    protected BeneficiaryPolicyVersionService $versions;

    protected PolicyFinancialEvaluationService $evaluator;

    protected PolicyApplicationScopeService $scopes;

    protected PolicyApplicationRunService $runs;

    protected int $nationalSeq = 0;

    protected User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->versions = app(BeneficiaryPolicyVersionService::class);
        $this->evaluator = app(PolicyFinancialEvaluationService::class);
        $this->scopes = app(PolicyApplicationScopeService::class);
        $this->runs = app(PolicyApplicationRunService::class);
        $this->admin = User::create([
            'username' => 'TEST_POLICYE1_ADMIN', 'full_name' => 'Policy E1 Admin',
            'password' => 'test-password', 'email' => 'policye1-admin@example.invalid',
            'role' => 'admin', 'is_active' => true,
        ]);
        Sanctum::actingAs($this->admin);
    }

    // ── Helpers ────────────────────────────────────────────────────────

    protected function makeBeneficiary(array $overrides = []): Beneficiary
    {
        $seq = ++$this->nationalSeq;

        return Beneficiary::create(array_merge([
            'beneficiary_type' => 'citizen',
            'full_name' => 'مواطن تجريبي',
            'national_id' => '1'.str_pad((string) $seq, 9, '0', STR_PAD_LEFT),
            'phone' => '05'.str_pad((string) $seq, 8, '0', STR_PAD_LEFT),
            'date_of_birth' => '1980-05-05',
            'family_status' => 'poor',
            'family_members_count' => 1,
            'housing_type' => 'own',
            'income_sources' => ['salary'],
            'monthly_salary' => 1000,
            'social_security_amount' => 0,
            'citizen_account_amount' => 0,
            'retirement_pension' => 0,
            'family_support' => 0,
            'status' => 'active',
        ], $overrides));
    }

    protected function makeVersion(array $config = [], array $overrides = []): BeneficiaryPolicyVersion
    {
        return BeneficiaryPolicyVersion::create(array_merge([
            'policy_name' => 'سياسة صرف المساعدات للمستفيدين',
            'policy_scope' => 'citizen_beneficiaries',
            'version' => (string) mt_rand(1000, 9999),
            'effective_from' => '2026-10-01',
            // Published configurations are stored validated+merged in production.
            'configuration' => PolicyConfigurationValidator::withDefaults($config),
        ], $overrides));
    }

    protected function publishVersion(array $config = [], array $overrides = []): BeneficiaryPolicyVersion
    {
        $version = $this->makeVersion($config, $overrides);
        $this->versions->approve($version->id, ['board_approval_reference' => 'قرار 1/2026', 'board_approval_date' => '2026-09-20'], $this->admin->id);
        $this->versions->publish($version->id, $this->admin->id);

        return $version->fresh();
    }

    protected function permissionUser(array $perms, string $role = 'assistant_admin'): User
    {
        return User::create([
            'username' => 'TEST_POLICYE1_'.strtoupper(substr(md5(uniqid('', true)), 0, 8)),
            'full_name' => 'Policy E1 User', 'password' => 'test-password',
            'email' => 'policye1-user-'.substr(md5(uniqid('', true)), 0, 12).'@example.invalid',
            'role' => $role,
            'permissions' => ['beneficiary_policy' => $perms],
            'is_active' => true,
        ]);
    }

    /**
     * POLICY-E2/E3 endpoints are real now, so the permission layer is proven
     * through the ACTUAL routes with REAL published versions and REAL runs —
     * no stubbed routes and no faked business outcomes.
     */
    protected function simulatableRun(): array
    {
        $version = $this->publishVersion(['application_scope' => ['applies_to' => 'all_existing_and_new']]);
        $run = $this->runs->create($version, [], $this->admin->id);

        return [$version, $run];
    }

    // ── CONFIGURATION (1–6) ────────────────────────────────────────────

    public function test_all_four_scope_modes_accepted(): void
    {
        foreach (['new_only', 'all_existing_and_new', 'selected_existing_and_new'] as $mode) {
            $validated = PolicyConfigurationValidator::validate(['application_scope' => ['applies_to' => $mode]]);
            $this->assertSame($mode, $validated['application_scope']['applies_to']);
        }
        $validated = PolicyConfigurationValidator::validate(['application_scope' => ['applies_to' => 'effective_from_date', 'effective_from_date' => '2026-01-01']]);
        $this->assertSame('effective_from_date', $validated['application_scope']['applies_to']);
        $this->assertSame('2026-01-01', $validated['application_scope']['effective_from_date']);
    }

    public function test_unknown_scope_mode_rejected(): void
    {
        $this->expectException(ValidationException::class);
        PolicyConfigurationValidator::validate(['application_scope' => ['applies_to' => 'retroactive_everything']]);
    }

    public function test_invalid_effective_date_combinations_rejected(): void
    {
        foreach ([
            ['applies_to' => 'effective_from_date'], // missing date
            ['applies_to' => 'effective_from_date', 'effective_from_date' => '2026-02-30'], // impossible date
            ['applies_to' => 'effective_from_date', 'effective_from_date' => '2026-1-5'], // non-canonical format
            ['applies_to' => 'new_only', 'effective_from_date' => '2026-01-01'], // date foreign to mode
            ['applies_to' => 'selected_existing_and_new', 'beneficiary_ids' => [(string) Str::uuid()]], // IDs are run-level, never config
            ['applies_to' => 'new_only', 'selected_ids' => []], // no competing scope field
        ] as $scope) {
            try {
                PolicyConfigurationValidator::validate(['application_scope' => $scope]);
                $this->fail('Expected ValidationException for: '.json_encode($scope));
            } catch (ValidationException) {
                $this->addToAssertionCount(1);
            }
        }
    }

    public function test_published_scope_is_immutable(): void
    {
        $version = $this->publishVersion(['application_scope' => ['applies_to' => 'new_only']]);
        $this->expectException(\Throwable::class);
        $this->versions->updateDraft($version->id, ['configuration' => ['application_scope' => ['applies_to' => 'all_existing_and_new']]], $this->admin->id);
    }

    public function test_default_scope_does_not_trigger_execution(): void
    {
        $this->makeBeneficiary();
        $version = $this->publishVersion(); // defaults: applies_to = all_existing_and_new
        $this->assertSame('all_existing_and_new', $version->configuration['application_scope']['applies_to']);
        $this->assertSame(0, PolicyApplicationRun::count());
        $this->assertSame(0, PolicyApplicationRunItem::count());
        $this->assertSame(0, DB::table('audit_logs')->where('action', 'like', 'POLICY_APPLICATION_RUN_%')->count());
    }

    // ── RUN (7–12) ─────────────────────────────────────────────────────

    public function test_run_created_with_uuid_and_version_reference(): void
    {
        $version = $this->publishVersion(['application_scope' => ['applies_to' => 'new_only']]);
        $run = $this->runs->create($version, [], $this->admin->id);

        $this->assertTrue(Str::isUuid($run->id));
        $this->assertSame($version->id, $run->policy_version_id);
        $this->assertSame(PolicyApplicationRun::STATUS_DRAFT, $run->status);
        $this->assertSame($version->id, $version->applicationRuns()->first()->policy_version_id);
        $this->assertDatabaseHas('audit_logs', ['action' => PolicyApplicationRunService::AUDIT_RUN_CREATED, 'target_id' => $run->id]);
    }

    public function test_run_stores_normalized_scope_mode_and_safe_parameters(): void
    {
        $b1 = $this->makeBeneficiary();
        $b2 = $this->makeBeneficiary();
        $version = $this->publishVersion(['application_scope' => ['applies_to' => 'selected_existing_and_new']]);

        $run = $this->runs->create($version, ['beneficiary_ids' => [$b2->id, $b1->id, $b2->id]], $this->admin->id);

        $this->assertSame('selected_existing_and_new', $run->scope_mode);
        $expected = [$b1->id, $b2->id];
        sort($expected, SORT_STRING);
        $this->assertSame(['beneficiary_ids' => $expected], $run->scope_parameters); // deduped + sorted
        $this->assertSame(
            $this->scopes->fingerprint($version->id, 'selected_existing_and_new', ['beneficiary_ids' => $expected]),
            $run->simulation_fingerprint
        );
        // The published configuration stays free of any beneficiary-ID list.
        $this->assertArrayNotHasKey('beneficiary_ids', $version->configuration['application_scope']);
    }

    public function test_run_counters_default_to_zero_and_effective_date_normalized(): void
    {
        $version = $this->publishVersion(['application_scope' => ['applies_to' => 'effective_from_date', 'effective_from_date' => '2026-06-01']]);
        $run = $this->runs->create($version, [], $this->admin->id)->fresh();

        $this->assertSame(['effective_from_date' => '2026-06-01'], $run->scope_parameters);
        foreach (['total_candidates', 'processed_count', 'success_count', 'review_count', 'not_applicable_count', 'failed_count'] as $counter) {
            $this->assertSame(0, $run->{$counter});
        }
    }

    public function test_run_requires_published_version_and_valid_params(): void
    {
        $draft = $this->makeVersion(['application_scope' => ['applies_to' => 'new_only']]);
        try {
            $this->runs->create($draft, [], $this->admin->id);
            $this->fail('draft version must not accept runs');
        } catch (ValidationException) {
            $this->addToAssertionCount(1);
        }

        $version = $this->publishVersion(['application_scope' => ['applies_to' => 'new_only']]);
        $this->expectException(ValidationException::class);
        $this->runs->create($version, ['beneficiary_ids' => [(string) Str::uuid()]], $this->admin->id); // incompatible combination
    }

    public function test_invalid_run_status_rejected_by_database(): void
    {
        $version = $this->publishVersion();
        $this->expectException(QueryException::class);
        DB::table('policy_application_runs')->insert([
            'id' => (string) Str::uuid(),
            'policy_version_id' => $version->id,
            'scope_mode' => 'new_only',
            'status' => 'bogus',
        ]);
    }

    // ── RUN ITEM (13–17) ───────────────────────────────────────────────

    public function test_run_item_created_and_evaluation_references_nullable(): void
    {
        $version = $this->publishVersion(['application_scope' => ['applies_to' => 'all_existing_and_new']]);
        $run = $this->runs->create($version, [], $this->admin->id);
        $b = $this->makeBeneficiary();

        $item = $this->runs->addItem($run, $b->id)->fresh();

        $this->assertTrue(Str::isUuid($item->id));
        $this->assertSame($run->id, $item->run_id);
        $this->assertSame($b->id, $item->beneficiary_id);
        $this->assertSame(PolicyApplicationRunItem::STATUS_PENDING, $item->status);
        $this->assertNull($item->source_evaluation_id);
        $this->assertNull($item->new_evaluation_id);
        $this->assertSame(0, $item->attempt_count);
        $this->assertSame($item->id, $run->items()->first()->id);
        $this->assertSame($run->id, $item->run->id);
        $this->assertSame($b->id, $item->beneficiary->id);
    }

    public function test_run_item_duplicate_beneficiary_rejected(): void
    {
        $version = $this->publishVersion(['application_scope' => ['applies_to' => 'all_existing_and_new']]);
        $run = $this->runs->create($version, [], $this->admin->id);
        $b = $this->makeBeneficiary();

        $this->runs->addItem($run, $b->id);
        try {
            $this->runs->addItem($run, $b->id);
            $this->fail('duplicate beneficiary in one run must be rejected');
        } catch (ValidationException) {
            $this->addToAssertionCount(1);
        }

        // Database-level idempotency backstop (race safety).
        $this->expectException(QueryException::class);
        DB::table('policy_application_run_items')->insert([
            ['id' => (string) Str::uuid(), 'run_id' => $run->id, 'beneficiary_id' => $b->id, 'status' => 'pending'],
            ['id' => (string) Str::uuid(), 'run_id' => $run->id, 'beneficiary_id' => $b->id, 'status' => 'pending'],
        ]);
    }

    public function test_run_item_attempt_count_non_negative_and_status_checked(): void
    {
        $version = $this->publishVersion(['application_scope' => ['applies_to' => 'all_existing_and_new']]);
        $run = $this->runs->create($version, [], $this->admin->id);
        $b = $this->makeBeneficiary();

        if (DB::getDriverName() === 'pgsql') {
            // PostgreSQL-only CHECK constraint (SQLite cannot ADD CHECK post-create).
            try {
                DB::table('policy_application_run_items')->insert([
                    'id' => (string) Str::uuid(), 'run_id' => $run->id, 'beneficiary_id' => $b->id,
                    'status' => 'pending', 'attempt_count' => -1,
                ]);
                $this->fail('negative attempt_count must be rejected');
            } catch (QueryException) {
                $this->addToAssertionCount(1);
            }
        } else {
            // SQLite: status enum carries the CHECK; counters are guarded by the model.
            $item = $this->runs->addItem($run, $b->id)->fresh();
            $this->assertSame(0, $item->attempt_count);
            $this->assertGreaterThanOrEqual(0, $item->attempt_count);
        }

        $this->expectException(QueryException::class);
        DB::table('policy_application_run_items')->insert([
            'id' => (string) Str::uuid(), 'run_id' => $run->id, 'beneficiary_id' => $b->id, 'status' => 'bogus',
        ]);
    }

    public function test_negative_run_counter_rejected_by_database(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            // The non-negative counter CHECK is PostgreSQL-only by design; the
            // constraint is proven on the Phase-2A QA database (PolicyE1PostgresTest).
            $this->markTestSkipped('counter CHECK constraints are PostgreSQL-only.');
        }
        $version = $this->publishVersion();
        $this->expectException(QueryException::class);
        DB::table('policy_application_runs')->insert([
            'id' => (string) Str::uuid(), 'policy_version_id' => $version->id,
            'scope_mode' => 'new_only', 'status' => 'draft', 'failed_count' => -1,
        ]);
    }

    // ── STATE MACHINE (18–25) ──────────────────────────────────────────

    public function test_run_happy_path_transitions(): void
    {
        $version = $this->publishVersion(['application_scope' => ['applies_to' => 'new_only']]);
        $run = $this->runs->create($version, [], $this->admin->id);

        $run = $this->runs->transition($run, 'simulated', $this->admin->id); // draft → simulated
        $this->assertSame('simulated', $run->status);
        $this->assertNotNull($run->simulated_at);
        $this->assertSame($this->admin->id, $run->simulation_created_by);
        $this->assertDatabaseHas('audit_logs', ['action' => PolicyApplicationRunService::AUDIT_SCOPE_SIMULATED, 'target_id' => $run->id]);

        $run = $this->runs->transition($run, 'approved_for_execution'); // simulated → approved_for_execution
        $this->assertSame('approved_for_execution', $run->status);

        $run = $this->runs->transition($run, 'running', $this->admin->id); // approved_for_execution → running
        $this->assertSame('running', $run->status);
        $this->assertNotNull($run->execution_started_at);
        $this->assertSame($this->admin->id, $run->execution_requested_by);
        $this->assertDatabaseHas('audit_logs', ['action' => PolicyApplicationRunService::AUDIT_RUN_STARTED, 'target_id' => $run->id]);

        $run = $this->runs->transition($run, 'completed'); // running → completed
        $this->assertSame('completed', $run->status);
        $this->assertNotNull($run->completed_at);
        $this->assertDatabaseHas('audit_logs', ['action' => PolicyApplicationRunService::AUDIT_RUN_COMPLETED, 'target_id' => $run->id]);
    }

    public function test_running_to_completed_with_errors_and_failed(): void
    {
        $version = $this->publishVersion(['application_scope' => ['applies_to' => 'new_only']]);
        foreach (['completed_with_errors' => PolicyApplicationRunService::AUDIT_RUN_COMPLETED_WITH_ERRORS, 'failed' => null] as $terminal => $event) {
            $run = $this->runs->create($version, [], $this->admin->id);
            $run = $this->runs->transition($run, 'simulated');
            $run = $this->runs->transition($run, 'approved_for_execution');
            $run = $this->runs->transition($run, 'running');
            $run = $this->runs->transition($run, $terminal);
            $this->assertSame($terminal, $run->status);
            $this->assertNotNull($run->completed_at);
            if ($event) {
                $this->assertDatabaseHas('audit_logs', ['action' => $event, 'target_id' => $run->id]);
            }
        }
    }

    public function test_cancellation_allowed_only_from_valid_states(): void
    {
        $version = $this->publishVersion(['application_scope' => ['applies_to' => 'new_only']]);
        foreach (['draft', 'simulated', 'approved_for_execution'] as $from) {
            $run = $this->runs->create($version, [], $this->admin->id);
            if ($from !== 'draft') {
                $run = $this->runs->transition($run, 'simulated');
            }
            if ($from === 'approved_for_execution') {
                $run = $this->runs->transition($run, 'approved_for_execution');
            }
            $run = $this->runs->transition($run, 'cancelled');
            $this->assertSame('cancelled', $run->status);
            $this->assertNotNull($run->cancelled_at);
            $this->assertDatabaseHas('audit_logs', ['action' => PolicyApplicationRunService::AUDIT_RUN_CANCELLED, 'target_id' => $run->id]);
        }
    }

    public function test_cancellation_rejected_from_running_and_terminal_states(): void
    {
        $version = $this->publishVersion(['application_scope' => ['applies_to' => 'new_only']]);
        foreach (['running', 'completed', 'cancelled'] as $from) {
            $run = $this->runs->create($version, [], $this->admin->id);
            $run->forceFill(['status' => $from])->save();
            try {
                $run->transitionTo('cancelled');
                $this->fail("cancel from {$from} must be rejected");
            } catch (ValidationException) {
                $this->addToAssertionCount(1);
            }
        }
    }

    public function test_illegal_transitions_rejected(): void
    {
        $version = $this->publishVersion(['application_scope' => ['applies_to' => 'new_only']]);

        foreach ([
            ['draft', 'running'], ['draft', 'completed'], ['draft', 'approved_for_execution'],
            ['simulated', 'completed'], ['approved_for_execution', 'completed'],
            ['completed', 'running'], ['cancelled', 'simulated'], ['failed', 'running'],
        ] as [$from, $to]) {
            $run = $this->runs->create($version, [], $this->admin->id);
            $run->forceFill(['status' => $from])->save(); // arrange state directly; transitions still guarded
            try {
                $run->transitionTo($to);
                $this->fail("illegal transition {$from} → {$to} must be rejected");
            } catch (ValidationException) {
                $this->addToAssertionCount(1);
            }
        }

        // Unknown target status is never allowed even from a valid state.
        $run = $this->runs->create($version, [], $this->admin->id);
        $this->expectException(ValidationException::class);
        $run->transitionTo('bogus');
    }

    public function test_item_state_machine_foundation(): void
    {
        $version = $this->publishVersion(['application_scope' => ['applies_to' => 'all_existing_and_new']]);
        $run = $this->runs->create($version, [], $this->admin->id);
        $item = $this->runs->addItem($run, $this->makeBeneficiary()->id);

        $item->transitionTo('simulated');
        $item->transitionTo('processing');
        $this->assertSame(1, $item->attempt_count);
        $item->transitionTo('failed');
        $this->assertNotNull($item->processed_at);
        $item->transitionTo('processing'); // explicit retry allowed from failed
        $this->assertSame(2, $item->attempt_count);
        $item->transitionTo('review_required');
        $this->assertNotNull($item->processed_at);

        $this->expectException(ValidationException::class);
        $item->transitionTo('pending'); // terminal → back is illegal
    }

    // ── FINGERPRINT (26–32) ────────────────────────────────────────────

    public function test_fingerprint_deterministic_and_order_insensitive(): void
    {
        $a = (string) Str::uuid();
        $b = (string) Str::uuid();
        $versionId = (string) Str::uuid();

        $p1 = $this->scopes->validateAndNormalize('selected_existing_and_new', ['beneficiary_ids' => [$a, $b]]);
        $p2 = $this->scopes->validateAndNormalize('selected_existing_and_new', ['beneficiary_ids' => [$b, $a, $a]]); // order + duplicates
        $this->assertSame($p1, $p2); // normalization is deterministic

        $f1 = $this->scopes->fingerprint($versionId, 'selected_existing_and_new', $p1);
        $f2 = $this->scopes->fingerprint($versionId, 'selected_existing_and_new', $p2);
        $this->assertSame($f1, $f2); // same normalized input => same fingerprint
        $this->assertMatchesRegularExpression('/^[0-9a-f]{64}$/', $f1);
    }

    public function test_fingerprint_changes_with_version_mode_and_date(): void
    {
        $versionId = (string) Str::uuid();
        $base = $this->scopes->fingerprint($versionId, 'new_only', []);

        $this->assertNotSame($base, $this->scopes->fingerprint((string) Str::uuid(), 'new_only', [])); // different version
        $this->assertNotSame($base, $this->scopes->fingerprint($versionId, 'all_existing_and_new', [])); // different scope
        $this->assertNotSame($base, $this->scopes->fingerprint($versionId, 'effective_from_date', ['effective_from_date' => '2026-01-01']));
        $this->assertNotSame(
            $this->scopes->fingerprint($versionId, 'effective_from_date', ['effective_from_date' => '2026-01-01']),
            $this->scopes->fingerprint($versionId, 'effective_from_date', ['effective_from_date' => '2026-01-02']) // different date
        );
    }

    public function test_fingerprint_never_accepts_sensitive_fields(): void
    {
        foreach (['password', 'token', 'iban', 'national_id', 'medical_contents', 'document_binary'] as $sensitive) {
            try {
                $this->scopes->validateAndNormalize('selected_existing_and_new', ['beneficiary_ids' => [(string) Str::uuid()], $sensitive => 'x']);
                $this->fail("sensitive field {$sensitive} must be rejected");
            } catch (ValidationException) {
                $this->addToAssertionCount(1);
            }
            try {
                $this->scopes->validateAndNormalize('new_only', [$sensitive => 'x']);
                $this->fail("sensitive field {$sensitive} must be rejected");
            } catch (ValidationException) {
                $this->addToAssertionCount(1);
            }
        }
    }

    public function test_scope_mode_validation_rejects_unknown_mode(): void
    {
        $this->expectException(ValidationException::class);
        $this->scopes->validateAndNormalize('everything_forever', []);
    }

    // ── PERMISSIONS (33–38) ────────────────────────────────────────────

    public function test_view_application_runs_permission_independent(): void
    {
        [$version, $run] = $this->simulatableRun();
        Sanctum::actingAs($this->permissionUser(['view_application_runs' => true]));

        $this->getJson('/api/beneficiary-policy/versions/'.$version->id.'/application-runs')->assertOk();
        $this->getJson('/api/beneficiary-policy/application-runs/'.$run->id)->assertOk();
        $this->getJson('/api/beneficiary-policy/application-runs/'.$run->id.'/items')->assertOk();
        $this->postJson('/api/beneficiary-policy/versions/'.$version->id.'/simulate')->assertForbidden();
        $this->postJson('/api/beneficiary-policy/versions/'.$version->id.'/application-runs')->assertForbidden();
        $this->postJson('/api/beneficiary-policy/application-runs/'.$run->id.'/execute')->assertForbidden();
        $this->postJson('/api/beneficiary-policy/application-runs/'.$run->id.'/simulate')->assertForbidden();
    }

    public function test_simulate_permission_independent(): void
    {
        [$version, $run] = $this->simulatableRun();
        Sanctum::actingAs($this->permissionUser(['simulate' => true]));

        // Real one-shot simulation endpoint (creates the run, read-only simulation).
        $this->postJson('/api/beneficiary-policy/versions/'.$version->id.'/simulate')->assertOk();
        // Simulating an existing draft run is also allowed.
        $this->postJson('/api/beneficiary-policy/application-runs/'.$run->id.'/simulate')->assertOk();
        $this->getJson('/api/beneficiary-policy/versions/'.$version->id.'/application-runs')->assertForbidden();
        $this->postJson('/api/beneficiary-policy/versions/'.$version->id.'/application-runs')->assertForbidden();
        $this->postJson('/api/beneficiary-policy/application-runs/'.$run->id.'/execute')->assertForbidden();
        $this->postJson('/api/beneficiary-policy/application-runs/'.$run->id.'/approve-application')->assertForbidden();
    }

    public function test_apply_scope_permission_independent(): void
    {
        $version = $this->publishVersion(['application_scope' => ['applies_to' => 'all_existing_and_new']]);
        Sanctum::actingAs($this->permissionUser(['apply_scope' => true]));

        $created = $this->postJson('/api/beneficiary-policy/versions/'.$version->id.'/application-runs')->assertCreated();
        $runId = $created->json('data.id');
        // apply_scope covers approval and cancellation.
        $this->postJson('/api/beneficiary-policy/application-runs/'.$runId.'/cancel')->assertOk();
        // Approval reaches the controller (permission passed) and conflicts on state.
        $this->postJson('/api/beneficiary-policy/application-runs/'.$runId.'/approve-application')->assertStatus(409);
        $this->postJson('/api/beneficiary-policy/versions/'.$version->id.'/simulate')->assertForbidden();
        $this->getJson('/api/beneficiary-policy/application-runs/'.$runId)->assertForbidden();
        $this->postJson('/api/beneficiary-policy/application-runs/'.$runId.'/execute')->assertForbidden();
    }

    public function test_execute_reevaluation_permission_independent(): void
    {
        [$version, $run] = $this->simulatableRun();
        app(PolicyApplicationSimulationService::class)->simulate($run, $this->admin->id);
        Sanctum::actingAs($this->permissionUser(['execute_reevaluation' => true]));

        // Permission passes; the runs are simply not approved/retryable yet.
        $this->postJson('/api/beneficiary-policy/application-runs/'.$run->id.'/execute')->assertStatus(409);
        $this->postJson('/api/beneficiary-policy/application-runs/'.$run->id.'/retry')->assertStatus(409);
        $this->postJson('/api/beneficiary-policy/versions/'.$version->id.'/simulate')->assertForbidden();
        $this->postJson('/api/beneficiary-policy/versions/'.$version->id.'/application-runs')->assertForbidden();
        $this->postJson('/api/beneficiary-policy/application-runs/'.$run->id.'/cancel')->assertForbidden();
        $this->getJson('/api/beneficiary-policy/application-runs/'.$run->id)->assertForbidden();
    }

    public function test_admin_retains_full_policy_e_access(): void
    {
        $this->makeBeneficiary();
        $version = $this->publishVersion(['application_scope' => ['applies_to' => 'all_existing_and_new']]);
        Sanctum::actingAs($this->admin);

        $created = $this->postJson('/api/beneficiary-policy/versions/'.$version->id.'/application-runs')->assertCreated();
        $runId = $created->json('data.id');
        $this->getJson('/api/beneficiary-policy/versions/'.$version->id.'/application-runs')->assertOk();
        $this->getJson('/api/beneficiary-policy/application-runs/'.$runId)->assertOk();
        $this->postJson('/api/beneficiary-policy/application-runs/'.$runId.'/simulate')->assertOk();
        $this->getJson('/api/beneficiary-policy/application-runs/'.$runId.'/items')->assertOk();
        $this->postJson('/api/beneficiary-policy/application-runs/'.$runId.'/approve-application')->assertOk();
        $this->postJson('/api/beneficiary-policy/application-runs/'.$runId.'/execute')->assertOk();
        $this->postJson('/api/beneficiary-policy/versions/'.$version->id.'/simulate')->assertOk();

        $response = $this->getJson('/api/beneficiary-policy/permissions')->assertOk();
        foreach (['simulate', 'apply_scope', 'execute_reevaluation', 'view_application_runs'] as $ability) {
            $this->assertTrue($response->json('data.'.$ability), "admin must have {$ability}");
        }
    }

    public function test_no_implicit_permission_escalation(): void
    {
        $id = (string) Str::uuid();
        // 'view' alone (configuration viewing) must NOT imply any POLICY-E ability.
        Sanctum::actingAs($this->permissionUser(['view' => true]));

        $this->postJson('/api/beneficiary-policy/versions/'.$id.'/simulate')->assertForbidden();
        $this->postJson('/api/beneficiary-policy/versions/'.$id.'/application-runs')->assertForbidden();
        $this->getJson('/api/beneficiary-policy/application-runs/'.$id)->assertForbidden();
        $this->getJson('/api/beneficiary-policy/application-runs/'.$id.'/items')->assertForbidden();
        $this->postJson('/api/beneficiary-policy/application-runs/'.$id.'/execute')->assertForbidden();

        // Permission map reports every POLICY-E ability as false.
        $response = $this->getJson('/api/beneficiary-policy/permissions')->assertOk();
        foreach (['simulate', 'apply_scope', 'execute_reevaluation', 'view_application_runs'] as $ability) {
            $this->assertFalse($response->json('data.'.$ability), "no implicit {$ability}");
        }
    }

    // ── HISTORY ISOLATION (39–41) ──────────────────────────────────────

    public function test_existing_evaluations_decisions_and_beneficiaries_untouched(): void
    {
        $b = $this->makeBeneficiary();
        $version = $this->publishVersion();
        $evaluation = $this->evaluator->evaluate($b->id, $version->id, $this->admin->id);
        $decision = PolicyDecision::create([
            'evaluation_id' => $evaluation->id,
            'policy_version_id' => $version->id,
            'decision' => 'approved',
            'decided_by' => $this->admin->id,
            'decided_at' => now(),
            'stable_reason_code' => 'POLICY_TEST',
            'human_readable_reason' => 'اختبار عزل السجل التاريخي',
        ]);

        $evaluationBefore = BeneficiaryPolicyEvaluation::findOrFail($evaluation->id)->toArray();
        $decisionBefore = PolicyDecision::findOrFail($decision->id)->toArray();
        $beneficiaryBefore = $b->fresh()->toArray();
        $countsBefore = [
            BeneficiaryPolicyEvaluation::count(),
            PolicyDecision::count(),
            Beneficiary::count(),
        ];

        // Full POLICY-E1 lifecycle activity around the same beneficiary/version.
        $run = $this->runs->create($version, [], $this->admin->id);
        $item = $this->runs->addItem($run, $b->id, $evaluation->id);
        $this->assertSame($evaluation->id, $item->source_evaluation_id);
        $run = $this->runs->transition($run, 'simulated', $this->admin->id);
        $run = $this->runs->transition($run, 'cancelled', $this->admin->id);

        // 39: existing policy evaluations untouched.
        $this->assertEquals($evaluationBefore, BeneficiaryPolicyEvaluation::findOrFail($evaluation->id)->toArray());
        // 40: existing PolicyDecision rows untouched.
        $this->assertEquals($decisionBefore, PolicyDecision::findOrFail($decision->id)->toArray());
        // 41: no beneficiary mutation.
        $this->assertEquals($beneficiaryBefore, $b->fresh()->toArray());
        $this->assertSame($countsBefore, [
            BeneficiaryPolicyEvaluation::count(),
            PolicyDecision::count(),
            Beneficiary::count(),
        ]);
    }
}
