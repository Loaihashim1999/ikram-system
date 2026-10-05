<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const FRACTION_COLUMNS = [
        'inventory_items' => ['current_quantity', 'min_threshold'],
        'inventory_movements' => ['quantity'],
    ];

    public function up(): void
    {
        Schema::table('inventory_items', function (Blueprint $table) {
            $table->decimal('current_quantity', 12, 2)->default(0)->change();
            $table->decimal('min_threshold', 12, 2)->default(10)->change();
        });

        Schema::table('inventory_movements', function (Blueprint $table) {
            $table->decimal('quantity', 12, 2)->change();
        });
    }

    public function down(): void
    {
        // Rollback safety: never silently truncate fractional precision.
        // If any fractional values exist, fail with a clear diagnostic instead.
        foreach (self::FRACTION_COLUMNS as $table => $columns) {
            foreach ($columns as $column) {
                $fractional = DB::table($table)
                    ->whereRaw("{$column} <> CAST({$column} AS BIGINT) OR {$column} > 2147483647 OR {$column} < -2147483648")
                    ->count();
                if ($fractional > 0) {
                    throw new RuntimeException(
                        "Cannot roll back decimal widening: {$table}.{$column} contains {$fractional} fractional or out-of-range value(s). "
                        .'Converting back to INTEGER would truncate them. Resolve the fractional data first (e.g. adjust stock to whole units) and retry.'
                    );
                }
            }
        }

        Schema::table('inventory_items', function (Blueprint $table) {
            $table->integer('current_quantity')->default(0)->change();
            $table->integer('min_threshold')->default(10)->change();
        });

        Schema::table('inventory_movements', function (Blueprint $table) {
            $table->integer('quantity')->change();
        });
    }
};
