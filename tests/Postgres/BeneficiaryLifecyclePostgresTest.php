<?php

namespace Tests\Postgres;

use Illuminate\Contracts\Console\Kernel;
use Tests\Feature\BeneficiaryLifecycleTest;

class BeneficiaryLifecyclePostgresTest extends BeneficiaryLifecycleTest
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
