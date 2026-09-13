<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->string('title')->nullable()->after('category');
            $table->string('action_url')->nullable()->after('message_body');
        });
    }

    public function down(): void
    {
        Schema::table('notifications', fn (Blueprint $table) => $table->dropColumn(['title', 'action_url']));
    }
};
