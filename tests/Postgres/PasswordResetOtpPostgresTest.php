<?php

namespace Tests\Postgres;

use Illuminate\Contracts\Console\Kernel;
use Tests\Feature\PasswordResetOtpTest;

/**
 * Runs the full SMS password-recovery suite against the local PostgreSQL QA
 * database (persistence, unique constraints and row-locking semantics).
 */
class PasswordResetOtpPostgresTest extends PasswordResetOtpTest
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
