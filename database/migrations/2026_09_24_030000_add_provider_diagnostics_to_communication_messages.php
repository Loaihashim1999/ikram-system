<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('communication_messages', function (Blueprint $table) {
            $table->json('provider_diagnostics')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('communication_messages', function (Blueprint $table) {
            $table->dropColumn('provider_diagnostics');
        });
    }
};
