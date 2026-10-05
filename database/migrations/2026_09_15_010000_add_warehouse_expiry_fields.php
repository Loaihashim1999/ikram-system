<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inventory_items', function (Blueprint $table) {
            if (! Schema::hasColumn('inventory_items', 'expiration_date')) {
                $table->date('expiration_date')->nullable()->index();
            }
            if (! Schema::hasColumn('inventory_items', 'basket_number')) {
                $table->string('basket_number', 100)->nullable();
            }
        });
    }

    public function down(): void
    {
        // SQLite requires the index to be dropped before its column.
        if (Schema::hasColumn('inventory_items', 'expiration_date')) {
            Schema::table('inventory_items', function (Blueprint $table) {
                $table->dropIndex(['expiration_date']);
            });
        }
        Schema::table('inventory_items', function (Blueprint $table) {
            $cols = array_filter(['expiration_date', 'basket_number'], fn ($col) => Schema::hasColumn('inventory_items', $col));
            if (! empty($cols)) {
                $table->dropColumn($cols);
            }
        });
    }
};
