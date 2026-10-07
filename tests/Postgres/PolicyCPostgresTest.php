<?php

namespace Tests\Postgres;

use App\Services\BeneficiaryPolicy\PolicyConfigurationValidator;
use App\Services\BeneficiaryPolicy\PolicyExceptionService;
use App\Services\BeneficiaryPolicy\PolicyOutcomeService;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\Feature\PolicyCExceptionsSnapshotAuthTest;

/**
 * Isolated PostgreSQL QA for POLICY-C (JSONB scoring/exception storage, score
 * decimal(12,4), category columns, versioned scoring configuration round-trip,
 * rollback / re-migrate of the policy architecture migration).
 *
 * Guarded by verifyPhase2aTarget() — refuses to run outside ikram_phase2a_qa
 * on 127.0.0.1:5432. Never run against an operational database.
 */
if (! defined('PHASE2A_PHPUNIT')) {
    define('PHASE2A_PHPUNIT', true);
}
require_once __DIR__.'/phase2a-bootstrap.php';

class PolicyCPostgresTest extends PolicyCExceptionsSnapshotAuthTest
{
    public function createApplication()
    {
        $app = require dirname(__DIR__, 2).'/bootstrap/app.php';
        $app->loadEnvironmentFrom('.env.phase2a.pgqa');
        $app->make(Kernel::class)->bootstrap();
        verifyPhase2aTarget();

        return $app;
    }

    public function test_policy_c_scoring_snapshot_stored_as_jsonb(): void
    {
        $b = $this->makeBeneficiary();
        $version = $this->publishVersion();
        $this->evaluator->evaluate($b->id, $version->id, $this->admin->id);

        $type = DB::selectOne(
            "SELECT data_type FROM information_schema.columns WHERE table_name = 'beneficiary_policy_evaluations' AND column_name = 'scoring_snapshot'"
        );
        $this->assertSame('jsonb', $type->data_type);

        $row = DB::selectOne('SELECT scoring_snapshot::jsonb AS snapshot FROM beneficiary_policy_evaluations WHERE policy_version_id = ?', [$version->id]);
        $this->assertNotNull($row);
        $snapshot = json_decode($row->snapshot, true);
        $this->assertSame('d', $snapshot['income']['category']);
        $this->assertSame('c', $snapshot['score_category']);
        $this->assertCount(6, $snapshot['components']);
        $this->assertSame(PolicyOutcomeService::OUTCOME_POLICY_REVIEW_REQUIRED, $snapshot['outcome']);
    }

    public function test_policy_c_numeric_and_category_columns_on_pg(): void
    {
        $score = DB::selectOne(
            'SELECT data_type, numeric_precision, numeric_scale FROM information_schema.columns WHERE table_name = ? AND column_name = ?',
            ['beneficiary_policy_evaluations', 'policy_score']
        );
        $this->assertSame('numeric', $score->data_type);
        $this->assertSame(12, (int) $score->numeric_precision);
        $this->assertSame(4, (int) $score->numeric_scale);

        foreach (['income_category', 'score_category'] as $column) {
            $col = DB::selectOne(
                'SELECT data_type, character_maximum_length FROM information_schema.columns WHERE table_name = ? AND column_name = ?',
                ['beneficiary_policy_evaluations', $column]
            );
            $this->assertSame('character varying', $col->data_type, "{$column} must be varchar on PostgreSQL.");
            $this->assertSame(50, (int) $col->character_maximum_length);
        }

        $b = $this->makeBeneficiary();
        $evaluation = $this->evaluator->evaluate($b->id, $this->publishVersion()->id, $this->admin->id);
        $row = DB::selectOne('SELECT income_category, score_category, policy_score FROM beneficiary_policy_evaluations WHERE id = ?', [$evaluation->id]);
        $this->assertSame('d', $row->income_category);
        $this->assertSame('c', $row->score_category);
        $this->assertSame('10.0000', $row->policy_score);
    }

    public function test_policy_c_versioned_scoring_configuration_jsonb_and_exception_persist(): void
    {
        $validated = PolicyConfigurationValidator::validate([
            'exceptions' => ['rules' => [[
                'code' => 'orphan_mother', 'enabled' => true, 'label' => 'أم يتيم',
                'income_ceiling' => 1200, 'requires_manual_review' => true,
                'condition' => ['field' => 'family_status', 'operator' => 'in', 'values' => ['widow_with_orphans']],
            ]]],
        ]);

        $version = $this->publishVersion([
            'exceptions' => $validated['exceptions'],
            'scoring' => $validated['scoring'],
            'score_categories' => $validated['score_categories'],
            'income_categories' => $validated['income_categories'],
        ]);

        $row = DB::selectOne('SELECT configuration::jsonb AS config FROM beneficiary_policy_versions WHERE id = ?', [$version->id]);
        $config = json_decode($row->config, true);
        $this->assertSame('orphan_mother', $config['exceptions']['rules'][0]['code']);
        $this->assertSame(75, (int) $config['scoring']['max_score']);

        // Evaluate a widow_with_orphans household above the threshold → exception persisted on PG.
        $b = $this->makeBeneficiary(['family_status' => 'widow_with_orphans', 'monthly_salary' => 1200]);
        $evaluation = $this->evaluator->evaluate($b->id, $version->id, $this->admin->id);

        $stored = DB::selectOne('SELECT exception_code, exception_details FROM beneficiary_policy_evaluations WHERE id = ?', [$evaluation->id]);
        $this->assertSame('orphan_mother', $stored->exception_code);
        $details = json_decode($stored->exception_details, true);
        $this->assertSame('review_required', $details['status']);
        $this->assertSame(PolicyOutcomeService::OUTCOME_EXCEPTION_REVIEW_REQUIRED, $evaluation->scoring_snapshot['outcome']);
    }

    public function test_generic_widow_review_required_persists_on_postgres(): void
    {
        // Corrected default match = widow_with_orphans ONLY; a generic widow above
        // the threshold persists exception review_required (never a silent ceiling).
        $version = $this->publishVersion();
        $b = $this->makeBeneficiary(['family_status' => 'widow', 'monthly_salary' => 1200]);
        $evaluation = $this->evaluator->evaluate($b->id, $version->id, $this->admin->id);

        $stored = DB::selectOne('SELECT exception_code, exception_details FROM beneficiary_policy_evaluations WHERE id = ?', [$evaluation->id]);
        $this->assertSame('orphan_mother', $stored->exception_code);
        $details = json_decode($stored->exception_details, true);
        $this->assertSame('review_required', $details['status']);
        $this->assertSame(PolicyExceptionService::REASON_EVIDENCE_REVIEW_REQUIRED, $details['reason']);
        $this->assertSame(PolicyOutcomeService::OUTCOME_EXCEPTION_REVIEW_REQUIRED, $evaluation->scoring_snapshot['outcome']);
    }

    public function test_policy_c_rollback_recreates_policy_c_columns(): void
    {
        $this->assertTrue(Schema::hasColumn('beneficiary_policy_evaluations', 'scoring_snapshot'));

        // POLICY-G: D/E tables now reference POLICY-A evaluations. Roll back
        // through the architecture migration and every later migration so
        // PostgreSQL drops dependants first. The migration ledger can contain
        // newer unrelated migrations in the same batch, so a fixed step count
        // would stop before this policy table's creating migration.
        $migrations = DB::table('migrations')
            ->orderByDesc('batch')
            ->orderByDesc('migration')
            ->pluck('migration')
            ->all();
        $baseMigration = '2026_09_21_010000_create_beneficiary_policy_architecture';
        $baseIndex = array_search($baseMigration, $migrations, true);
        $this->assertNotFalse($baseIndex, 'Policy architecture migration must be present in the isolated QA ledger.');
        Artisan::call('migrate:rollback', ['--step' => $baseIndex + 1]);
        $this->assertFalse(Schema::hasTable('beneficiary_policy_evaluations'));

        Artisan::call('migrate');
        $this->assertTrue(Schema::hasTable('beneficiary_policy_evaluations'));
        foreach (['scoring_snapshot', 'income_category', 'policy_score', 'score_category', 'exception_code', 'exception_details'] as $column) {
            $this->assertTrue(Schema::hasColumn('beneficiary_policy_evaluations', $column), $column);
        }
    }
}
