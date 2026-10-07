<?php

namespace Tests\Postgres;

use Illuminate\Contracts\Console\Kernel;
use Tests\Feature\DeliveryCommunicationTest;

if (! defined('PHASE2A_PHPUNIT')) {
    define('PHASE2A_PHPUNIT', true);
}
require_once __DIR__.'/phase2a-bootstrap.php';

/** Reassignment membership history on guarded local PostgreSQL QA only. */
class DeliveryReassignmentPostgresTest extends DeliveryCommunicationTest
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
