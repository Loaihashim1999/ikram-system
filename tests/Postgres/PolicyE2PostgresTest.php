<?php

namespace Tests\Postgres;

use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\Feature\PolicyE2SimulationTest;

if (! defined('PHASE2A_PHPUNIT')) {
    define('PHASE2A_PHPUNIT', true);
}
require_once __DIR__.'/phase2a-bootstrap.php';

/**
 * POLICY-E2/E4 — PostgreSQL QA proof (guarded: .env.phase2a.pgqa →
 * pgsql @ 127.0.0.1:5432/ikram_phase2a_qa only). Re-runs the read-only
 * simulation suite (candidate enumeration SQL, date boundary, JSONB item
 * snapshots) and the registration-integration suite on PostgreSQL, plus the
 * driver-aware E2/E3 additive migration rollback/re-migrate with its PG FK.
 */
class PolicyE2PostgresTest extends PolicyE2SimulationTest
{
    public function createApplication()
    {
        $app = require dirname(__DIR__, 2).'/bootstrap/app.php';
        $app->loadEnvironmentFrom('.env.phase2a.pgqa');
        $app->make(Kernel::class)->bootstrap();
        verifyPhase2aTarget();

        return $app;
    }

    public function test_policy_e2_additive_migration_rolls_back_and_reapplies_on_pg(): void
    {
        $migration = include dirname(__DIR__, 2).'/database/migrations/2026_09_22_050000_policy_e2_simulation_execution_columns.php';
        $migration->down();
        $this->assertFalse(Schema::hasColumn('policy_application_runs', 'simulation_summary'));
        $this->assertFalse(Schema::hasColumn('policy_application_runs', 'approved_by'));

        $migration->up();
        $this->assertTrue(Schema::hasColumn('policy_application_runs', 'simulation_summary'));
        $this->assertTrue(Schema::hasColumn('policy_application_runs', 'approved_at'));

        // The pgsql branch adds a real FK on approved_by (SQLite cannot).
        $foreignKey = DB::selectOne(
            "SELECT conname FROM pg_constraint WHERE conrelid = 'policy_application_runs'::regclass AND contype = 'f' AND conname LIKE '%approved_by%'"
        );
        $this->assertNotNull($foreignKey, 'approved_by must be a real foreign key on PostgreSQL');
    }
}
