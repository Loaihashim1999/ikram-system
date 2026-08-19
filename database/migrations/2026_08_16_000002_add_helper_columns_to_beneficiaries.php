<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('beneficiaries', function (Blueprint $table) {
            if (! Schema::hasColumn('beneficiaries', 'is_elderly')) {
                $table->boolean('is_elderly')->default(false);
            }
            if (! Schema::hasColumn('beneficiaries', 'is_special_needs')) {
                $table->boolean('is_special_needs')->default(false);
            }
        });
    }

    public function down(): void
    {
        Schema::table('beneficiaries', function (Blueprint $table) {
            if (Schema::hasColumn('beneficiaries', 'is_elderly')) {
                $table->dropColumn('is_elderly');
            }
            if (Schema::hasColumn('beneficiaries', 'is_special_needs')) {
                $table->dropColumn('is_special_needs');
            }
        });
    }
};
