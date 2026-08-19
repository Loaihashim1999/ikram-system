<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('distributions') && ! Schema::hasColumn('distributions', 'driver_id')) {
            Schema::table('distributions', function (Blueprint $table) {
                $table->string('driver_id')->nullable()->after('assigned_by');
            });
        }

        if (Schema::hasTable('rep_distributions') && ! Schema::hasColumn('rep_distributions', 'driver_id')) {
            Schema::table('rep_distributions', function (Blueprint $table) {
                $table->string('driver_id')->nullable()->after('rep_id');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('distributions') && Schema::hasColumn('distributions', 'driver_id')) {
            Schema::table('distributions', function (Blueprint $table) {
                $table->dropColumn('driver_id');
            });
        }

        if (Schema::hasTable('rep_distributions') && Schema::hasColumn('rep_distributions', 'driver_id')) {
            Schema::table('rep_distributions', function (Blueprint $table) {
                $table->dropColumn('driver_id');
            });
        }
    }
};
