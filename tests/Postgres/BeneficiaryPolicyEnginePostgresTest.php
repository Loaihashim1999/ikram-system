<?php

namespace Tests\Postgres;

use App\Models\BeneficiaryPolicyVersion;
use App\Services\BeneficiaryPolicy\BeneficiaryPolicyEvaluationService;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Tests\Feature\BeneficiaryPolicyEngineTest;

/**
 * Isolated PostgreSQL QA for POLICY-A (JSONB, constraints, FK behavior,
 * lifecycle, evaluation history, rollback / re-migrate).
 *
 * Guarded by verifyPhase2aTarget() — refuses to run outside ikram_phase2a_qa
 * on 127.0.0.1:5432. Never run against an operational database.
 */
if (! defined('PHASE2A_PHPUNIT')) {
    define('PHASE2A_PHPUNIT', true);
}
require_once __DIR__.'/phase2a-bootstrap.php';

class BeneficiaryPolicyEnginePostgresTest extends BeneficiaryPolicyEngineTest
{
    public function createApplication()
    {
        $app = require dirname(__DIR__, 2).'/bootstrap/app.php';
        $app->loadEnvironmentFrom('.env.phase2a.pgqa');
        $app->make(Kernel::class)->bootstrap();
        verifyPhase2aTarget();

        return $app;
    }

    public function test_postgres_jsonb_config_storage_and_backstops(): void
    {
        $version = $this->publishVersion();
        $config = $version->fresh()->configuration;
        $this->assertSame(['salary', 'social_security', 'citizen_account'], $config['financial']['counted_income_sources']);

        $type = DB::selectOne(
            "SELECT data_type FROM information_schema.columns WHERE table_name = 'beneficiary_policy_versions' AND column_name = 'configuration'"
        );
        $this->assertSame('jsonb', $type->data_type);

        $index = DB::selectOne(
            "SELECT indexname FROM pg_indexes WHERE tablename = 'beneficiary_policy_versions' AND indexname = 'beneficiary_policy_versions_one_published_per_scope_start'"
        );
        $this->assertNotNull($index);

        $constraint = DB::selectOne(
            "SELECT conname FROM pg_constraint WHERE conrelid = 'beneficiary_policy_versions'::regclass AND conname = 'beneficiary_policy_versions_dates_ordered'"
        );
        $this->assertNotNull($constraint);
    }

    public function test_postgres_backstop_rejects_duplicate_published_start(): void
    {
        BeneficiaryPolicyVersion::create([
            'policy_name' => 'سياسة الاختبار', 'policy_scope' => 'citizen_beneficiaries', 'version' => '1',
            'status' => 'published', 'effective_from' => '2026-01-01', 'configuration' => [],
        ]);

        $this->expectException(QueryException::class);
        BeneficiaryPolicyVersion::create([
            'policy_name' => 'سياسة الاختبار', 'policy_scope' => 'citizen_beneficiaries', 'version' => '2',
            'status' => 'published', 'effective_from' => '2026-01-01', 'configuration' => [],
        ]);
    }

    public function test_postgres_backstop_rejects_reversed_effective_dates(): void
    {
        $this->expectException(QueryException::class);
        BeneficiaryPolicyVersion::create([
            'policy_name' => 'سياسة التواريخ', 'policy_scope' => 'citizen_beneficiaries', 'version' => '1',
            'status' => 'draft', 'effective_from' => '2026-12-31', 'effective_to' => '2026-01-01', 'configuration' => [],
        ]);
    }

    public function test_postgres_fk_behavior_preserves_evaluations(): void
    {
        $version = $this->publishVersion();
        $b = $this->beneficiary();
        $evaluation = app(BeneficiaryPolicyEvaluationService::class)->create([
            'beneficiary_id' => $b->id, 'policy_version_id' => $version->id, 'net_income_per_capita' => 300,
        ], $this->admin->id);
        $this->assertNotNull($evaluation->id);

        // Deleted beneficiary keeps the immutable evaluation (nullOnDelete sets
        // the reference to null instead of cascading the history away).
        $b->delete();
        $this->assertDatabaseHas('beneficiary_policy_evaluations', ['id' => $evaluation->id, 'beneficiary_id' => null]);

        // Published versions cannot be referenced away once evaluations exist (restrictOnDelete).
        $this->expectException(QueryException::class);
        DB::table('beneficiary_policy_versions')->where('id', $version->id)->delete();
    }
}
