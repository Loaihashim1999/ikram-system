<?php

namespace Tests\Postgres;

use Illuminate\Contracts\Console\Kernel;
use Tests\Acceptance\PolicyDControllerAuthorizationTest;

// The same HTTP workflow and permission acceptance suite on guarded local PostgreSQL.
class PolicyDIntegrationPostgresTest extends PolicyDControllerAuthorizationTest
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
