<?php

use App\Models\User;
use Illuminate\Session\DatabaseSessionHandler;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

require __DIR__.'/phase2a-bootstrap.php';

$schema = 'migration_rehearsal_'.bin2hex(random_bytes(6));
DB::statement('CREATE SCHEMA "'.$schema.'"');
config(['database.connections.pgsql.search_path' => $schema]);
DB::purge('pgsql');
if (DB::selectOne('SELECT current_schema() AS name')->name !== $schema) {
    throw new RuntimeException('Rehearsal schema mismatch.');
}
if (Artisan::call('migrate', ['--force' => true, '--no-interaction' => true]) !== 0) {
    throw new RuntimeException('Rehearsal migration failed.');
}
$expected = count(glob(database_path('migrations/*.php')));
if (DB::table('migrations')->count() !== $expected) {
    throw new RuntimeException('Migration count mismatch.');
}
foreach (['sessions', 'cache', 'cache_locks', 'jobs', 'failed_jobs', 'job_batches'] as $table) {
    if (! Schema::hasTable($table)) {
        throw new RuntimeException('Missing infrastructure table: '.$table);
    }
}
if (Schema::getColumnType('sessions', 'user_id') !== 'uuid' || Schema::getColumnType('users', 'id') !== 'uuid' || Schema::getColumnType('staff_distributions', 'staff_member_id') !== 'uuid') {
    throw new RuntimeException('UUID compatibility failure.');
}
if (DB::table('users')->exists() || DB::table('system_initializations')->count() !== 1) {
    throw new RuntimeException('Unexpected initialization data.');
}

// Exercise writes only in the new disposable local schema, then roll them back.
DB::beginTransaction();
try {
    $user = User::factory()->create();
    $handler = new DatabaseSessionHandler(DB::connection(), 'sessions', 120, app());
    app('auth')->setUser($user);
    $handler->write('migration-rehearsal-session', 'probe');
    if (DB::table('sessions')->value('user_id') !== $user->id) {
        throw new RuntimeException('UUID session persistence failed.');
    }
} finally {
    DB::rollBack();
}

$hardening = require database_path('migrations/2026_09_28_000001_harden_production_schema_compatibility.php');
DB::beginTransaction();
try {
    DB::statement('ALTER TABLE sessions ALTER COLUMN user_id TYPE bigint USING user_id::text::bigint');
    DB::table('sessions')->insert(['id' => 'legacy', 'user_id' => 1, 'payload' => '', 'last_activity' => 0]);
    try {
        $hardening->up();
        throw new LogicException('Unsafe populated session conversion was accepted.');
    } catch (RuntimeException $e) {
        if (! str_contains($e->getMessage(), 'Existing sessions')) {
            throw $e;
        }
    }
    if (DB::table('sessions')->value('user_id') !== 1) {
        throw new RuntimeException('Legacy session data changed.');
    }
} finally {
    DB::rollBack();
}

$constraint = DB::selectOne("SELECT count(*) AS n FROM pg_constraint WHERE conrelid = 'medical_evidence'::regclass AND conname = 'medical_evidence_percentage_range'");
if ((int) $constraint->n !== 1) {
    throw new RuntimeException('Medical range constraint missing.');
}
Artisan::call('migrate:status', ['--no-interaction' => true]);
echo 'PASS '.$expected.' migrations; infrastructure, UUID sessions, legacy safety, medical constraint; schema='.$schema.PHP_EOL;
