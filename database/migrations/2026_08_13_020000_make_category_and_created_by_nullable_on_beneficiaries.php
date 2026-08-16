<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('beneficiaries', function (Blueprint $table) {
            $table->uuid('category_id')->nullable()->change();
            $table->uuid('created_by')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('beneficiaries', function (Blueprint $table) {
            $table->uuid('category_id')->nullable(false)->change();
            $table->uuid('created_by')->nullable(false)->change();
        });
    }
};
