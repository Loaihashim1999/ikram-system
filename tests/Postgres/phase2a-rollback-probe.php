<?php

use App\Models\InventoryItem;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

try {
    require __DIR__.'/phase2a-bootstrap.php';
    $migration = require dirname(__DIR__, 2).'/database/migrations/2026_09_19_040000_widen_general_warehouse_quantities_to_decimal.php';
    foreach ([['inventory_items', 'current_quantity', '2.50'], ['inventory_items', 'min_threshold', '0.75'], ['inventory_movements', 'quantity', '0.75']] as [$table, $column, $value]) {
        DB::beginTransaction();
        try {
            $stock = InventoryItem::create(['name' => 'TEST rollback probe', 'unit' => 'kg', 'current_quantity' => 10, 'min_threshold' => 0]);
            $id = $stock->id;
            if ($table === 'inventory_movements') {
                $id = (string) Str::uuid();
                DB::table($table)->insert(['id' => $id, 'inventory_item_id' => $stock->id, 'type' => 'in', 'quantity' => $value]);
            } else {
                DB::table($table)->where('id', $id)->update([$column => $value]);
            }
            $refused = false;
            try {
                $migration->down();
            } catch (RuntimeException $e) {
                if (! str_starts_with($e->getMessage(), 'Cannot roll back decimal widening:')) {
                    throw $e;
                }
                $refused = true;
            }
            $type = DB::selectOne('SELECT data_type FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = ? AND column_name = ?', [$table, $column])->data_type;
            $stored = DB::table($table)->where('id', $id)->value($column);
            if (! $refused || $type !== 'numeric' || (float) $stored !== (float) $value) {
                throw new RuntimeException('Fractional rollback protection failed');
            }
            echo json_encode(['test' => 'fractional_rollback_refusal', 'column' => $table.'.'.$column, 'value' => $stored, 'type_after_refusal' => $type, 'result' => 'PASS']).PHP_EOL;
        } finally {
            DB::rollBack();
        }
    }
} catch (Throwable $e) {
    fwrite(STDERR, 'Rollback probe failed: '.get_class($e).PHP_EOL);
    exit(1);
}
