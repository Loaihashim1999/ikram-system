<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::getConnection()->getDriverName() === 'sqlite') {
            return;
        }
        $this->preserve('beneficiaries', 'created_by');
        $this->preserve('distributions', 'assigned_by');
        $this->preserve('inventory_movements', 'user_id');
        $this->preserve('audit_logs', 'user_id');
    }

    private function preserve(string $table, string $column): void
    {
        if (! Schema::hasTable($table) || ! Schema::hasColumn($table, $column)) {
            return;
        }
        // SQLite cannot alter or drop a named foreign key without rebuilding the
        // whole table. Tests still exercise account deactivation, while MySQL and
        // PostgreSQL receive the production null-on-delete constraint.
        if (DB::getDriverName() === 'sqlite') {
            return;
        }
        Schema::table($table, function (Blueprint $blueprint) use ($table, $column) {
            $blueprint->dropForeign($table.'_'.$column.'_foreign');
            $blueprint->uuid($column)->nullable()->change();
            $blueprint->foreign($column)->references('id')->on('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        // Historical actor columns intentionally remain nullable; reverting to cascades risks data loss.
    }
};
