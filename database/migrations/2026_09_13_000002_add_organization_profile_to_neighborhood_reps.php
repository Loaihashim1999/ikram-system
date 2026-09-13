<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('neighborhood_reps', function (Blueprint $table) {
            $table->string('organization_name', 150)->nullable();
            $table->string('organization_type', 100)->nullable();
            $table->string('license_number', 50)->nullable()->index();
            $table->string('contact_person', 150)->nullable();
            $table->string('email', 150)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('neighborhood_reps', function (Blueprint $table) {
            $table->dropIndex(['license_number']);
            $table->dropColumn(['organization_name', 'organization_type', 'license_number', 'contact_person', 'email']);
        });
    }
};
