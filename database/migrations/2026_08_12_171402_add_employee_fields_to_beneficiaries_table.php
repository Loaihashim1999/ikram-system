<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('beneficiaries', function (Blueprint $table) {
            if (!Schema::hasColumn('beneficiaries', 'job_title')) {
                $table->string('job_title')->nullable();
            }
            if (!Schema::hasColumn('beneficiaries', 'job_sector')) {
                $table->string('job_sector')->nullable();
            }
            if (!Schema::hasColumn('beneficiaries', 'nationality')) {
                $table->string('nationality')->default('سعودي');
            }
            if (!Schema::hasColumn('beneficiaries', 'wives_count')) {
                $table->integer('wives_count')->default(0);
            }
            if (!Schema::hasColumn('beneficiaries', 'owns_house')) {
                $table->boolean('owns_house')->default(false);
            }
            if (!Schema::hasColumn('beneficiaries', 'national_address_image_url')) {
                $table->string('national_address_image_url')->nullable();
            }
            if (!Schema::hasColumn('beneficiaries', 'rental_contract_image_url')) {
                $table->string('rental_contract_image_url')->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('beneficiaries', function (Blueprint $table) {
            $table->dropColumn([
                'job_title', 'job_sector', 'nationality',
                'wives_count', 'owns_house',
                'national_address_image_url', 'rental_contract_image_url',
            ]);
        });
    }
};
