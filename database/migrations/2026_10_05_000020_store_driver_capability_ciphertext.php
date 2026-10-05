<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('driver_assignments', function (Blueprint $table) {
            $table->text('capability_ciphertext')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('driver_assignments', function (Blueprint $table) {
            $table->dropColumn('capability_ciphertext');
        });
    }
};
