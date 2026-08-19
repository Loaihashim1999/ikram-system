<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('neighborhood_reps', function (Blueprint $table) {
            if (! Schema::hasColumn('neighborhood_reps', 'city')) {
                $table->string('city', 100)->default('مكة المكرمة')->after('district_name');
            }
            if (! Schema::hasColumn('neighborhood_reps', 'status')) {
                $table->string('status', 20)->default('active')->after('beneficiaries_count');
            }
            if (! Schema::hasColumn('neighborhood_reps', 'national_address_doc_url')) {
                $table->string('national_address_doc_url', 255)->nullable();
            }
            if (! Schema::hasColumn('neighborhood_reps', 'dependents_ids_zip_url')) {
                $table->string('dependents_ids_zip_url', 255)->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('neighborhood_reps', function (Blueprint $table) {
            $table->dropColumn(['city', 'status', 'national_address_doc_url', 'dependents_ids_zip_url']);
        });
    }
};
