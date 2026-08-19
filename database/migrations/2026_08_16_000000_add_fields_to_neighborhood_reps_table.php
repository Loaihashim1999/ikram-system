<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('neighborhood_reps', function (Blueprint $table) {
            if (! Schema::hasColumn('neighborhood_reps', 'national_id')) {
                $table->string('national_id', 20)->nullable()->after('phone');
            }
            if (! Schema::hasColumn('neighborhood_reps', 'date_of_birth')) {
                $table->date('date_of_birth')->nullable()->after('national_id');
            }
            if (! Schema::hasColumn('neighborhood_reps', 'national_address')) {
                $table->string('national_address', 255)->nullable()->after('district_name');
            }
        });
    }

    public function down(): void
    {
        Schema::table('neighborhood_reps', function (Blueprint $table) {
            $table->dropColumn(['national_id', 'date_of_birth', 'national_address']);
        });
    }
};
