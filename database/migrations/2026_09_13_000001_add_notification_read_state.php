<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up(): void {
        Schema::table('notifications', function (Blueprint $table) {
            $table->string('category', 40)->default('system_event');
            $table->timestamp('read_at')->nullable();
            $table->string('event_key', 64)->nullable()->unique();
            $table->index(['recipient_id', 'read_at']);
        });
    }
    public function down(): void {
        Schema::table('notifications', function (Blueprint $table) {
            $table->dropIndex(['recipient_id', 'read_at']);
            $table->dropUnique(['event_key']);
            $table->dropColumn(['category', 'read_at', 'event_key']);
        });
    }
};
