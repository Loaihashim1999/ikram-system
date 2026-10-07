<?php

/**
 * Backend remote-access hard preflight (FSA Section 2/3).
 *
 * Boots Laravel with explicit safe test-only overrides, resolves the
 * effective configuration, and fails hard unless the DB is isolated SQLite
 * or the guarded local PostgreSQL QA target, the provider is fake, and
 * telemetry is disabled. Prints only safe values.
 */

require __DIR__.'/bootstrap.php';

$env = fsaEnv();
if (($argv[1] ?? null) === 'pgsql_qa') {
    $root = dirname(__DIR__, 2);
    $qaFile = $root.'/.env.phase2a.pgqa';
    if (! is_file($qaFile)) {
        throw new RuntimeException('ABORT: local QA environment file is missing.');
    }
    $qa = array_merge(Dotenv\Dotenv::parse(file_get_contents($qaFile)), ['APP_ENV' => 'testing', 'DB_URL' => '', 'COMMUNICATION_PROVIDER' => 'fake', 'SENTRY_DSN' => '', 'SENTRY_LARAVEL_DSN' => '']);
    $env = fsaEnv($qa);
}
fsaBoot($env);
