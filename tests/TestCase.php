<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    public function createApplication()
    {
        $app = parent::createApplication();
        $driver = $app['config']->get('database.default');
        $connection = $app['config']->get('database.connections.'.$driver, []);
        // Guard before RefreshDatabase can run a query or migration.
        $safeSqlite = $driver === 'sqlite' && ($connection['database'] ?? null) === ':memory:';
        $safeLocalQa = $driver === 'pgsql'
            && ($connection['host'] ?? null) === '127.0.0.1'
            && (string) ($connection['port'] ?? '') === '5432'
            && ($connection['database'] ?? null) === 'ikram_phase2a_qa'
            && ($connection['username'] ?? null) === 'ikram_qa_user';
        if ((! $safeSqlite && ! $safeLocalQa) || ! empty($connection['url'])) {
            throw new \RuntimeException('ABORT: unsafe resolved test database; no query permitted.');
        }

        return $app;
    }
}
