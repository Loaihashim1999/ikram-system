<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->string('event_type', 100)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('notifications', fn (Blueprint $table) => $table->dropColumn('event_type'));
    }
};
