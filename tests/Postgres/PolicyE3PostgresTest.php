<?php

namespace Tests\Postgres;

use Illuminate\Contracts\Console\Kernel;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Feature\PolicyE3ExecutionTest;

if (! defined('PHASE2A_PHPUNIT')) {
    define('PHASE2A_PHPUNIT', true);
}
require_once __DIR__.'/phase2a-bootstrap.php';

/**
 * POLICY-E3 — PostgreSQL QA proof (guarded: .env.phase2a.pgqa →
 * pgsql @ 127.0.0.1:5432/ikram_phase2a_qa only). Re-runs the controlled
 * execution suite on PostgreSQL: FOR UPDATE row locks / per-item transactions,
 * staleness re-verification (candidate hash over re-enumerated SQL), retry,
 * cancellation, HTTP permissions and the 409 stable-code contract.
 */
class PolicyE3PostgresTest extends PolicyE3ExecutionTest
{
    public function createApplication()
    {
        $app = require dirname(__DIR__, 2).'/bootstrap/app.php';
        $app->loadEnvironmentFrom('.env.phase2a.pgqa');
        $app->make(Kernel::class)->bootstrap();
        verifyPhase2aTarget();

        return $app;
    }

    public function test_run_item_unique_backstop_sqlstate_on_pg(): void
    {
        $this->expectException(QueryException::class);

        [$actor, $version, $approved] = $this->approvedRun(1);
        $item = $approved->items()->firstOrFail();

        try {
            DB::table('policy_application_run_items')->insert([
                'id' => (string) Str::uuid(),
                'run_id' => $approved->id,
                'beneficiary_id' => $item->beneficiary_id,
                'status' => 'pending',
            ]);
        } catch (QueryException $e) {
            $this->assertSame('23505', $e->getCode()); // unique_violation
            $this->assertStringContainsString('policy_application_run_items_run_id_beneficiary_id', $e->getMessage());

            throw $e;
        }

        $this->fail('unique(run_id, beneficiary_id) must reject duplicates on PostgreSQL');
    }
}
