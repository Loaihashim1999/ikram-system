<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Drop constraint on postgresql if exists
        try {
            DB::statement('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;');
        } catch (Exception $e) {
            // ignore
        }

        Schema::table('users', function (Blueprint $table) {
            $table->string('role', 50)->default('staff')->change();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('role', 50)->default('staff')->change();
        });
    }
};
