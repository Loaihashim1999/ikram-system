<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inventory_items', function (Blueprint $table) {
            $table->decimal('reserved_quantity', 12, 2)->default(0)->after('current_quantity');
        });

        Schema::table('inventory_movements', function (Blueprint $table) {
            $table->decimal('balance_after', 12, 2)->nullable()->after('quantity');
            $table->foreignUuid('support_distribution_id')->nullable()->after('balance_after')->constrained('support_distributions')->nullOnDelete();
            $table->index('support_distribution_id');
        });

        if (Schema::getConnection()->getDriverName() === 'pgsql') {
            // Hard invariants — the service layer enforces them independently;
            // the database is the last line of defense, never the only one.
            DB::statement('
                ALTER TABLE inventory_items
                ADD CONSTRAINT inventory_items_reservation_invariants CHECK (
                    current_quantity >= 0
                    AND reserved_quantity >= 0
                    AND reserved_quantity <= current_quantity
                )
            ');
        }
    }

    public function down(): void
    {
        if (Schema::getConnection()->getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE inventory_items DROP CONSTRAINT IF EXISTS inventory_items_reservation_invariants');
        }
        Schema::table('inventory_movements', function (Blueprint $table) {
            $table->dropIndex(['support_distribution_id']);
            $table->dropConstrainedForeignId('support_distribution_id');
            $table->dropColumn('balance_after');
        });
        Schema::table('inventory_items', function (Blueprint $table) {
            $table->dropColumn('reserved_quantity');
        });
    }
};
