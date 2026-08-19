<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (\Illuminate\Support\Facades\Schema::getConnection()->getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE staff_distributions DROP CONSTRAINT IF EXISTS staff_distributions_staff_member_id_foreign');
            DB::statement("ALTER TABLE staff_distributions ALTER COLUMN staff_member_id TYPE bigint USING NULLIF(staff_member_id::text, '')::bigint");
        }
    }

    public function down(): void
    {
        if (\Illuminate\Support\Facades\Schema::getConnection()->getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE staff_distributions ALTER COLUMN staff_member_id TYPE uuid USING NULL');
        }
    }
};
