<?php

/**
 * FSA test-only environment contract.
 *
 * Every standalone Full System Acceptance process boots through this file.
 * It never falls back to the ordinary .env: the caller supplies explicit
 * fsaEnv() values, the app boots from those values, and fsaAssertSafe()
 * aborts the process unless the RESOLVED configuration is isolated SQLite
 * (or the explicitly guarded local PostgreSQL QA target), the communication
 * provider is fake, and telemetry is disabled.
 *
 * Never prints database passwords or provider credentials.
 */

require_once dirname(__DIR__, 2).'/vendor/autoload.php';

use Illuminate\Contracts\Console\Kernel;

function fsaEnv(array $overrides = []): array
{
    return array_merge([
        'APP_ENV' => 'testing',
        'APP_DEBUG' => 'false',
        'APP_KEY' => 'base64:'.base64_encode(random_bytes(32)),
        'DB_CONNECTION' => 'sqlite',
        'DB_DATABASE' => ':memory:',
        'DB_URL' => '',
        'CACHE_STORE' => 'array',
        'SESSION_DRIVER' => 'array',
        'QUEUE_CONNECTION' => 'sync',
        'MAIL_MAILER' => 'array',
        'BCRYPT_ROUNDS' => '4',
        'LOG_CHANNEL' => 'stderr',
        'COMMUNICATION_PROVIDER' => 'fake',
        'SENTRY_DSN' => '',
        'SENTRY_LARAVEL_DSN' => '',
        'PULSE_ENABLED' => 'false',
        'TELESCOPE_ENABLED' => 'false',
        'NIGHTWATCH_ENABLED' => 'false',
        'APP_CONFIG_CACHE' => dirname(__DIR__, 2).'/.tmp/fsa-evidence/nonexistent-config.php',
    ], $overrides);
}

function fsaApplyEnv(array $env): void
{
    foreach ($env as $key => $value) {
        putenv($key.'='.$value);
        $_ENV[$key] = $_SERVER[$key] = $value;
    }
}

function fsaAssertSafe(): array
{
    $driver = config('database.default');
    $connection = config('database.connections.'.$driver);
    $provider = config('services.communications.provider', 'fake');
    $sentry = config('sentry.dsn');
    if (! in_array($driver, ['sqlite', 'pgsql'], true)) {
        throw new RuntimeException('ABORT: resolved DB driver '.$driver.' is outside the approved FSA set.');
    }
    if ($driver === 'pgsql') {
        $expected = ['host' => '127.0.0.1', 'port' => '5432', 'database' => 'ikram_phase2a_qa', 'username' => 'ikram_qa_user'];
        foreach (['host', 'port', 'database', 'username'] as $key) {
            if ((string) ($connection[$key] ?? '') !== $expected[$key]) {
                throw new RuntimeException('ABORT: resolved PostgreSQL target is not the guarded local QA database ('.$key.').');
            }
        }
        if (! empty($connection['url'])) {
            throw new RuntimeException('ABORT: PostgreSQL DB_URL must be absent for the FSA process.');
        }
    } elseif ($driver === 'sqlite') {
        $database = $connection['database'] ?? ':memory:';
        if (is_string($database) && str_contains($database, 'ikram_phase2a_qa')) {
            throw new RuntimeException('ABORT: SQLite driver must not point at the PostgreSQL QA name.');
        }
    }
    if ($provider !== 'fake') {
        throw new RuntimeException('ABORT: COMMUNICATION_PROVIDER resolved to '.$provider.'; only fake is allowed for FSA.');
    }
    if (! empty($sentry)) {
        throw new RuntimeException('ABORT: a telemetry DSN is enabled; FSA requires blank telemetry.');
    }
    $safe = [
        'DB_DRIVER' => $driver,
        'COMMUNICATION_PROVIDER' => $provider,
        'TELEMETRY_DISABLED' => 'YES',
    ];
    if ($driver === 'pgsql') {
        $safe['DB_HOST'] = (string) $connection['host'];
        $safe['DB_DATABASE'] = (string) $connection['database'];
    } elseif (($connection['database'] ?? ':memory:') !== ':memory:') {
        $safe['DB_DATABASE'] = basename((string) $connection['database']);
    }
    foreach ($safe as $key => $value) {
        echo $key.'='.$value.PHP_EOL;
    }

    return $safe;
}

function fsaBoot(array $env): array
{
    fsaApplyEnv($env);
    $app = require dirname(__DIR__, 2).'/bootstrap/app.php';
    $app->make(Kernel::class)->bootstrap();

    return fsaAssertSafe();
}
