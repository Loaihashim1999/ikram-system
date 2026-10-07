<?php

use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;

// Standalone acceptance bootstrap: never falls back to the ordinary .env.
require_once dirname(__DIR__, 2).'/vendor/autoload.php';

$qaRoot = dirname(__DIR__, 2);
$qaFile = $qaRoot.'/.env.phase2a.pgqa';
if (! is_file($qaFile)) {
    throw new RuntimeException('Local QA environment file is missing.');
}
$qaValues = Dotenv\Dotenv::parse(file_get_contents($qaFile));
$qaExpected = ['DB_CONNECTION' => 'pgsql', 'DB_HOST' => '127.0.0.1', 'DB_PORT' => '5432', 'DB_DATABASE' => 'ikram_phase2a_qa'];
foreach ($qaExpected as $qaKey => $qaValue) {
    if (($qaValues[$qaKey] ?? null) !== $qaValue) {
        throw new RuntimeException('ABORT: QA target mismatch for '.$qaKey);
    }
}
if (($qaValues['DB_USERNAME'] ?? '') !== 'ikram_qa_user' || empty($qaValues['DB_PASSWORD']) || ! empty($qaValues['DB_URL'])) {
    throw new RuntimeException('ABORT: valid local QA credentials required; DB_URL must be absent.');
}
// Export only this file and deterministic test settings. Disable remote telemetry.
$qaValues = array_merge($qaValues, [
    'APP_ENV' => 'testing', 'APP_DEBUG' => 'false', 'DB_URL' => '',
    'CACHE_STORE' => 'array', 'SESSION_DRIVER' => 'array', 'QUEUE_CONNECTION' => 'sync',
    'MAIL_MAILER' => 'array', 'BCRYPT_ROUNDS' => '4', 'LOG_CHANNEL' => 'stderr',
    'SENTRY_LARAVEL_DSN' => '', 'SENTRY_DSN' => '', 'APP_CONFIG_CACHE' => $qaRoot.'/.tmp/phase2a-evidence/nonexistent-config.php',
]);
foreach ($qaValues as $qaKey => $qaValue) {
    putenv($qaKey.'='.$qaValue);
    $_ENV[$qaKey] = $_SERVER[$qaKey] = $qaValue;
}
function verifyPhase2aTarget(): void
{
    $expected = ['DB_CONNECTION' => 'pgsql', 'DB_HOST' => '127.0.0.1', 'DB_PORT' => '5432', 'DB_DATABASE' => 'ikram_phase2a_qa'];
    $connection = config('database.connections.'.config('database.default'));
    $actual = ['DB_CONNECTION' => config('database.default'), 'DB_HOST' => $connection['host'], 'DB_PORT' => (string) $connection['port'], 'DB_DATABASE' => $connection['database']];
    if ($actual !== $expected || ! empty($connection['url'])) {
        throw new RuntimeException('ABORT: resolved QA target mismatch.');
    }
    foreach ($actual as $key => $value) {
        fwrite(STDOUT, $key.'='.$value.PHP_EOL);
    }
    try {
        $identity = DB::selectOne('SELECT current_database() AS db, current_user AS usr');
    } catch (Throwable $e) {
        throw new RuntimeException('QA connection failed; credentials omitted.');
    }
    if ($identity->db !== 'ikram_phase2a_qa' || $identity->usr !== 'ikram_qa_user') {
        throw new RuntimeException('ABORT: server identity mismatch.');
    }
}

if (! defined('PHASE2A_PHPUNIT')) {
    $qaApp = require $qaRoot.'/bootstrap/app.php';
    $qaApp->loadEnvironmentFrom('.env.phase2a.pgqa');
    $qaApp->make(Kernel::class)->bootstrap();
    verifyPhase2aTarget();
}
