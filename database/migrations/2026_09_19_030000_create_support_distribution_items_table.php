<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('support_distribution_items', function (Blueprint $table) {
            $idCol = $table->uuid('id')->primary();
            if (Schema::getConnection()->getDriverName() === 'pgsql') {
                $idCol->default(DB::raw('gen_random_uuid()'));
            }
            $table->foreignUuid('support_distribution_id')->constrained('support_distributions')->cascadeOnDelete();
            $table->foreignUuid('inventory_item_id')->constrained('inventory_items')->restrictOnDelete();
            // Decimal quantities — General Warehouse supports fractional units (kg, …).
            $table->decimal('requested_quantity', 12, 2);
            $table->decimal('reserved_quantity', 12, 2)->default(0);
            $table->decimal('fulfilled_quantity', 12, 2)->default(0);
            $table->string('unit_snapshot', 50)->nullable();
            $table->timestamps();

            $table->unique(['support_distribution_id', 'inventory_item_id']);
        });

        if (Schema::getConnection()->getDriverName() === 'pgsql') {
            DB::statement('
                ALTER TABLE support_distribution_items
                ADD CONSTRAINT support_items_quantities_check CHECK (
                    requested_quantity > 0
                    AND reserved_quantity >= 0
                    AND fulfilled_quantity >= 0
                    AND reserved_quantity <= requested_quantity
                    AND fulfilled_quantity <= requested_quantity
                )
            ');
        }
    }

    public function down(): void
    {
        if (Schema::getConnection()->getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE support_distribution_items DROP CONSTRAINT IF EXISTS support_items_quantities_check');
        }
        Schema::dropIfExists('support_distribution_items');
    }
};
