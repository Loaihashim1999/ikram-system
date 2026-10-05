<?php

// Process environment can take precedence over PHPUnit's $_ENV overrides.
// Set all sources before Laravel boots, even when a local config cache exists.
require_once dirname(__DIR__, 2).'/vendor/autoload.php';

$testCache = __DIR__.'/nonexistent-config.php';
if (is_file($testCache)) {
    throw new RuntimeException('ABORT: test configuration cache must be absent.');
}
foreach ([
    'APP_ENV' => 'testing', 'APP_DEBUG' => 'false', 'APP_CONFIG_CACHE' => $testCache,
    'DB_CONNECTION' => 'sqlite', 'DB_DATABASE' => ':memory:', 'DB_URL' => '',
    'COMMUNICATION_PROVIDER' => 'fake', 'QUEUE_CONNECTION' => 'sync',
    'CACHE_STORE' => 'array', 'SESSION_DRIVER' => 'array', 'MAIL_MAILER' => 'array',
    'SENTRY_DSN' => '', 'SENTRY_LARAVEL_DSN' => '', 'NIGHTWATCH_ENABLED' => 'false',
] as $testKey => $testValue) {
    putenv($testKey.'='.$testValue);
    $_ENV[$testKey] = $_SERVER[$testKey] = $testValue;
}
unset($testKey, $testValue, $testCache);
