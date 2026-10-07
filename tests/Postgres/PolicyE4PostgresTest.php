<?php

namespace Tests\Postgres;

use Illuminate\Contracts\Console\Kernel;
use Tests\Feature\PolicyE4RegistrationTest;

if (! defined('PHASE2A_PHPUNIT')) {
    define('PHASE2A_PHPUNIT', true);
}
require_once __DIR__.'/phase2a-bootstrap.php';

/**
 * POLICY-E4 — PostgreSQL QA proof (guarded: .env.phase2a.pgqa →
 * pgsql @ 127.0.0.1:5432/ikram_phase2a_qa only). Re-runs the registration
 * integration suite on PostgreSQL: date-only applicable-version window
 * (whereDate), the effective_from_date boundary, JSONB audit details and the
 * ancillary (never-breaking) evaluation contract inside the registration
 * transaction.
 */
class PolicyE4PostgresTest extends PolicyE4RegistrationTest
{
    public function createApplication()
    {
        $app = require dirname(__DIR__, 2).'/bootstrap/app.php';
        $app->loadEnvironmentFrom('.env.phase2a.pgqa');
        $app->make(Kernel::class)->bootstrap();
        verifyPhase2aTarget();

        return $app;
    }
}
