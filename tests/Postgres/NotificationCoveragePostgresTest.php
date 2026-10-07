<?php

namespace Tests\Postgres;

use Illuminate\Contracts\Console\Kernel;
use Tests\Feature\NotificationCoverageAuditTest;

if (! defined('PHASE2A_PHPUNIT')) {
    define('PHASE2A_PHPUNIT', true);
}
require_once __DIR__.'/phase2a-bootstrap.php';

class NotificationCoveragePostgresTest extends NotificationCoverageAuditTest
{
    public function createApplication()
    {
        $app = require dirname(__DIR__, 2).'/bootstrap/app.php';
        $app->loadEnvironmentFrom('.env.phase2a.pgqa');
        $this->traitsUsedByTest = class_uses_recursive(static::class);
        $app->make(Kernel::class)->bootstrap();
        verifyPhase2aTarget();

        return $app;
    }
}
