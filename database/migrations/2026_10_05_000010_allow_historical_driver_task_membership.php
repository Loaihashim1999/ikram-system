<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Existing memberships stay active because released_at is added as NULL.
     * down() refuses once any release exists, so rollback cannot drop that history.
     */
    public function up(): void
    {
        Schema::table('driver_assignment_tasks', function (Blueprint $table) {
            $table->timestamp('released_at')->nullable();
            $table->dropUnique(['support_distribution_id']);
        });
        DB::statement('CREATE UNIQUE INDEX driver_assignment_tasks_active_task_unique ON driver_assignment_tasks (support_distribution_id) WHERE released_at IS NULL');
    }

    public function down(): void
    {
        if (DB::table('driver_assignment_tasks')->whereNotNull('released_at')->exists()) {
            throw new RuntimeException('Rollback refused: historical driver task releases exist.');
        }
        DB::statement('DROP INDEX IF EXISTS driver_assignment_tasks_active_task_unique');
        Schema::table('driver_assignment_tasks', function (Blueprint $table) {
            $table->unique('support_distribution_id');
            $table->dropColumn('released_at');
        });
    }
};
