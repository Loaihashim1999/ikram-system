<?php

namespace Tests\Postgres;

use Illuminate\Contracts\Console\Kernel;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\Feature\PolicyE1RunLedgerTest;

if (! defined('PHASE2A_PHPUNIT')) {
    define('PHASE2A_PHPUNIT', true);
}
require_once __DIR__.'/phase2a-bootstrap.php';

/**
 * POLICY-E1 — PostgreSQL QA proof (guarded: .env.phase2a.pgqa →
 * pgsql @ 127.0.0.1:5432/ikram_phase2a_qa only). Re-runs the whole E1 feature
 * suite on PostgreSQL and additionally proves the database-specific
 * constraints: UUID/JSONB types, unique(run_id, beneficiary_id), status and
 * counter CHECK constraints, FK behavior, rollback + re-migrate.
 */
class PolicyE1PostgresTest extends PolicyE1RunLedgerTest
{
    public function createApplication()
    {
        $app = require dirname(__DIR__, 2).'/bootstrap/app.php';
        $app->loadEnvironmentFrom('.env.phase2a.pgqa');
        $app->make(Kernel::class)->bootstrap();
        verifyPhase2aTarget();

        return $app;
    }

    public function test_policy_e_tables_exist_on_pg(): void
    {
        $this->assertTrue(Schema::hasTable('policy_application_runs'));
        $this->assertTrue(Schema::hasTable('policy_application_run_items'));
    }

    public function test_policy_e_column_types_on_pg(): void
    {
        $column = fn (string $table, string $name) => DB::selectOne(
            'SELECT data_type FROM information_schema.columns WHERE table_name = ? AND column_name = ?',
            [$table, $name]
        )->data_type;

        $this->assertSame('uuid', $column('policy_application_runs', 'id'));
        $this->assertSame('uuid', $column('policy_application_run_items', 'id'));
        $this->assertSame('jsonb', $column('policy_application_runs', 'scope_parameters'));
        $this->assertSame('jsonb', $column('policy_application_run_items', 'simulation_result'));
    }

    public function test_policy_e_unique_backstop_sqlstate_on_pg(): void
    {
        $version = $this->publishVersion();
        $run = $this->runs->create($version, [], $this->admin->id);
        $b = $this->makeBeneficiary();
        $this->runs->addItem($run, $b->id);

        DB::beginTransaction(); // savepoint: a constraint error aborts the tx on PG
        try {
            DB::table('policy_application_run_items')->insert([
                'id' => (string) Str::uuid(), 'run_id' => $run->id, 'beneficiary_id' => $b->id, 'status' => 'pending',
            ]);
            DB::rollBack();
            $this->fail('unique(run_id, beneficiary_id) must reject duplicates');
        } catch (QueryException $e) {
            DB::rollBack();
            $this->assertSame('23505', $e->getCode()); // unique_violation
        }
    }

    public function test_policy_e_status_check_constraint_on_pg(): void
    {
        $version = $this->publishVersion();
        DB::beginTransaction();
        try {
            DB::table('policy_application_runs')->insert([
                'id' => (string) Str::uuid(), 'policy_version_id' => $version->id,
                'scope_mode' => 'new_only', 'status' => 'bogus',
            ]);
            DB::rollBack();
            $this->fail('invalid run status must be rejected');
        } catch (QueryException $e) {
            DB::rollBack();
            $this->assertSame('23514', $e->getCode()); // check_violation
        }
    }

    public function test_policy_e_version_delete_restricted_and_actor_nullable_on_pg(): void
    {
        $version = $this->publishVersion();
        $run = $this->runs->create($version, [], $this->admin->id);

        // Historical run → policy version linkage is protected (RESTRICT).
        DB::beginTransaction(); // savepoint: the FK error aborts the tx on PG
        try {
            DB::table('beneficiary_policy_versions')->where('id', $version->id)->delete();
            DB::rollBack();
            $this->fail('policy version with runs must not be deletable');
        } catch (QueryException $e) {
            DB::rollBack();
            $this->assertSame('23503', $e->getCode()); // foreign_key_violation
        }

        // Actor removal must NOT erase historical runs (NULL on delete).
        $actor = $this->permissionUser(['view_application_runs' => true]);
        DB::table('policy_application_runs')->where('id', $run->id)->update(['requested_by' => $actor->id]);
        DB::table('users')->where('id', $actor->id)->delete();
        $this->assertNull(DB::table('policy_application_runs')->where('id', $run->id)->value('requested_by'));
        $this->assertSame(1, DB::table('policy_application_runs')->where('id', $run->id)->count());
    }

    public function test_policy_e_migration_rolls_back_and_reapplies_on_pg(): void
    {
        $migration = include dirname(__DIR__, 2).'/database/migrations/2026_09_22_040000_policy_e_application_run_ledger.php';
        $migration->down();
        $this->assertFalse(Schema::hasTable('policy_application_runs'));
        $this->assertFalse(Schema::hasTable('policy_application_run_items'));

        $migration->up();
        $this->assertTrue(Schema::hasTable('policy_application_runs'));
        $this->assertTrue(Schema::hasTable('policy_application_run_items'));

        // Constraints survive re-migration.
        $checks = DB::select(
            "SELECT conname FROM pg_constraint WHERE conrelid = 'policy_application_runs'::regclass AND contype = 'c'"
        );
        $this->assertContains('policy_application_runs_failed_count_non_negative', array_column($checks, 'conname'));
    }
}
