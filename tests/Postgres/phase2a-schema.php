<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

try {
    require __DIR__.'/phase2a-bootstrap.php';
    $rolledBack = ($argv[1] ?? '') === 'rolled-back';
    $count = DB::table('migrations')->where('migration', 'like', '2026_09_19_%')->count();
    if ($count !== ($rolledBack ? 0 : 6)) {
        throw new RuntimeException('Migration record mismatch');
    }
    foreach (['pickup_locations', 'support_distributions', 'support_distribution_items'] as $table) {
        if (Schema::hasTable($table) === $rolledBack) {
            throw new RuntimeException('Support schema mismatch');
        }
    }
    foreach (['inventory_items' => ['current_quantity', 'min_threshold'], 'inventory_movements' => ['quantity']] as $table => $columns) {
        foreach ($columns as $column) {
            $row = DB::selectOne('SELECT data_type, numeric_precision, numeric_scale FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = ? AND column_name = ?', [$table, $column]);
            if ($row->data_type !== ($rolledBack ? 'integer' : 'numeric')) {
                throw new RuntimeException('Quantity type mismatch');
            }
            if (! $rolledBack && ((int) $row->numeric_precision !== 12 || (int) $row->numeric_scale !== 2)) {
                throw new RuntimeException('Quantity precision mismatch');
            }
        }
    }
    if (Schema::hasColumn('inventory_items', 'reserved_quantity') === $rolledBack) {
        throw new RuntimeException('Reservation schema mismatch');
    }
    echo 'PASS schema '.($rolledBack ? 'after six-migration rollback' : 'after re-migration').PHP_EOL;
} catch (Throwable $e) {
    fwrite(STDERR, 'Schema verification failed: '.get_class($e).PHP_EOL);
    exit(1);
}
