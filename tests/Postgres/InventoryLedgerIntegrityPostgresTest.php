<?php

namespace Tests\Postgres;

use Illuminate\Contracts\Console\Kernel;
use Tests\Feature\InventoryLedgerIntegrityTest;

class InventoryLedgerIntegrityPostgresTest extends InventoryLedgerIntegrityTest
{
    public function createApplication()
    {
        $app = require dirname(__DIR__, 2).'/bootstrap/app.php';
        $app->loadEnvironmentFrom('.env.phase2a.pgqa');
        $this->traitsUsedByTest = class_uses_recursive(static::class);
        $app->make(Kernel::class)->bootstrap();
        // Verify the dedicated local QA target before RefreshDatabase can migrate.
        verifyPhase2aTarget();

        return $app;
    }
}
