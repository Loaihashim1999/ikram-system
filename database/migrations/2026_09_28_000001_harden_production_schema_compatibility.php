<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        if (Schema::getColumnType('users', 'id') !== 'uuid') {
            throw new RuntimeException('Unexpected users primary key type; manual review required.');
        }

        if (Schema::getColumnType('sessions', 'user_id') !== 'uuid') {
            // Hold the lock through the empty-table check and type change.
            DB::statement('LOCK TABLE sessions IN ACCESS EXCLUSIVE MODE');
            if (DB::table('sessions')->exists()) {
                throw new RuntimeException('Existing sessions have an incompatible user reference type; manual review required.');
            }
            DB::statement('ALTER TABLE sessions ALTER COLUMN user_id TYPE uuid USING user_id::text::uuid');
        }

        DB::statement('ALTER TABLE medical_evidence ADD CONSTRAINT medical_evidence_percentage_range CHECK (verified_disability_percentage >= 0 AND verified_disability_percentage <= 100)');
    }

    public function down(): void
    {
        // Preserve compatible session identifiers and evidence validation.
    }
};
