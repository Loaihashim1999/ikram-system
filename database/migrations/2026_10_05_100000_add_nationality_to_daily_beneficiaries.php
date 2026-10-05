<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('daily_beneficiaries', function (Blueprint $table) {
            $table->string('nationality', 100)->nullable();
            $table->string('beneficiary_type', 20)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('daily_beneficiaries', function (Blueprint $table) {
            $table->dropColumn(['nationality', 'beneficiary_type']);
        });
    }
};
