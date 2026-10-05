<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class DeploymentHealthTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Config::set('session.driver', 'database');
    }

    public function test_liveness_does_not_require_database_access(): void
    {
        $this->configureUnavailableDatabase();

        $this->getJson('/health')
            ->assertOk()
            ->assertExactJson(['status' => 'ok']);
    }

    public function test_readiness_returns_a_generic_status_when_database_is_available(): void
    {
        $this->getJson('/readiness')
            ->assertOk()
            ->assertExactJson(['status' => 'ready']);
    }

    public function test_readiness_returns_a_generic_unavailable_status_when_database_is_down(): void
    {
        $this->configureUnavailableDatabase();

        $this->getJson('/readiness')
            ->assertServiceUnavailable()
            ->assertExactJson(['status' => 'unavailable']);
    }

    private function configureUnavailableDatabase(): void
    {
        Config::set('database.default', 'sqlite');
        Config::set(
            'database.connections.sqlite.database',
            sys_get_temp_dir().DIRECTORY_SEPARATOR.'ikram-readiness-missing-'.uniqid().DIRECTORY_SEPARATOR.'database.sqlite'
        );
        DB::purge('sqlite');
    }
}
