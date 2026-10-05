<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('drivers', function (Blueprint $table) {
            $table->boolean('whatsapp_opt_in')->default(false);
            $table->timestamp('whatsapp_opt_in_at')->nullable();
            $table->timestamp('whatsapp_opt_out_at')->nullable();
            $table->string('whatsapp_opt_in_source', 100)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('drivers', function (Blueprint $table) {
            $table->dropColumn(['whatsapp_opt_in', 'whatsapp_opt_in_at', 'whatsapp_opt_out_at', 'whatsapp_opt_in_source']);
        });
    }
};
