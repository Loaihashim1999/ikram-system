<?php

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

try {
    require __DIR__.'/phase2a-bootstrap.php';
    $mode = $argv[1] ?? 'identity';
    $allowed = ['identity', 'migrate', 'rollback', 'test'];
    if (! in_array($mode, $allowed, true)) {
        throw new RuntimeException('Unknown QA command.');
    }
    if ($mode === 'identity') {
        $uuid = DB::selectOne('SELECT gen_random_uuid() AS id')->id;
        if (! Str::isUuid($uuid)) {
            throw new RuntimeException('Invalid PostgreSQL UUID.');
        }
        echo "PASS UUID generation and QA connection\n";
    } elseif ($mode === 'test') {
        $process = proc_open([PHP_BINARY, 'vendor/phpunit/phpunit/phpunit', '--configuration', 'phpunit.xml', '--bootstrap', 'tests/Postgres/phase2a-test-bootstrap.php', '--fail-on-risky', '--log-junit', '.tmp/phase2a-evidence/pg-junit.xml', '--filter', $argv[2] ?? 'SupportEnginePostgresTest', 'tests/Postgres/SupportEnginePostgresTest.php'], [STDIN, STDOUT, STDERR], $pipes, dirname(__DIR__, 2));
        exit(proc_close($process));
    } else {
        $command = $mode === 'rollback' ? 'migrate:rollback' : 'migrate';
        $args = ['--force' => true, '--no-interaction' => true];
        // Roll back only the six Phase 2A migrations, irrespective of batching.
        if ($mode === 'rollback') {
            foreach (['inventory_items' => ['current_quantity', 'min_threshold'], 'inventory_movements' => ['quantity']] as $table => $columns) {
                foreach ($columns as $column) {
                    if (DB::table($table)->whereRaw("{$column} <> CAST({$column} AS BIGINT) OR {$column} > 2147483647 OR {$column} < -2147483648")->exists()) {
                        throw new RuntimeException('ABORT: fractional or out-of-range data; rollback preflight failed.');
                    }
                }
            }
            if (DB::table('inventory_items')->where('reserved_quantity', '>', 0)->exists()) {
                throw new RuntimeException('ABORT: active reservations must be resolved before rollback.');
            }
            $latest = DB::table('migrations')->orderByDesc('id')->limit(6)->pluck('migration');
            if ($latest->count() !== 6 || $latest->contains(fn ($name) => ! str_starts_with($name, '2026_09_19_'))) {
                throw new RuntimeException('ABORT: latest migrations do not match the six Phase 2A migrations.');
            }
            $args['--step'] = 6;
        }
        $exit = Artisan::call($command, $args);
        echo Artisan::output();
        exit($exit);
    }
} catch (Throwable $e) {
    // No stack traces or connection configuration (including passwords).
    fwrite(STDERR, 'QA gate failed: '.get_class($e).' (details withheld from connection errors)'.PHP_EOL);
    exit(1);
}
