<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->index(['recipient_id', 'read_at', 'created_at'], 'notifications_recipient_read_created_index');
            $table->index(['read_at', 'created_at'], 'notifications_read_created_index');
        });
    }

    public function down(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->dropIndex('notifications_recipient_read_created_index');
            $table->dropIndex('notifications_read_created_index');
        });
    }
};
