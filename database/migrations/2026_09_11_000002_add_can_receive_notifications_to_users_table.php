<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Add can_receive_notifications column to users table if missing
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'can_receive_notifications')) {
                $table->boolean('can_receive_notifications')->default(false)->after('is_active');
            }
        });

        // Ensure recipient_type in notifications table is varchar rather than rigid enum
        if (Schema::hasTable('notifications')) {
            try {
                if (Schema::getConnection()->getDriverName() === 'pgsql') {
                    DB::statement('ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_recipient_type_check;');
                }
            } catch (\Throwable $e) {
                // ignore if constraint doesn't exist
            }

            try {
                Schema::table('notifications', function (Blueprint $table) {
                    $table->string('recipient_type', 50)->default('staff')->change();
                });
            } catch (\Throwable $e) {
                // ignore if already string or driver limitation
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'can_receive_notifications')) {
                $table->dropColumn('can_receive_notifications');
            }
        });
    }
};
