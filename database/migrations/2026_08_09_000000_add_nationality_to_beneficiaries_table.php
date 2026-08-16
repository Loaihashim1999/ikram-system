<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // The original migration has this column; this keeps existing databases aligned.
        if (!Schema::hasColumn('beneficiaries', 'nationality')) {
            Schema::table('beneficiaries', function (Blueprint $table) {
                $table->string('nationality', 100)->nullable();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('beneficiaries', 'nationality')) {
            Schema::table('beneficiaries', function (Blueprint $table) {
                $table->dropColumn('nationality');
            });
        }
    }
};
