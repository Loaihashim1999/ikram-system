<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // Legacy history tables whose destructive CASCADE behavior must stop:
    // deleting a beneficiary/basket/rep must never erase distribution history.
    private const HARDENED_FOREIGN_KEYS = [
        ['table' => 'distributions', 'column' => 'beneficiary_id', 'referenced' => 'beneficiaries'],
        ['table' => 'distributions', 'column' => 'basket_id', 'referenced' => 'baskets'],
        ['table' => 'rep_distributions', 'column' => 'rep_id', 'referenced' => 'neighborhood_reps'],
        ['table' => 'rep_distributions', 'column' => 'basket_id', 'referenced' => 'baskets'],
        ['table' => 'staff_distributions', 'column' => 'basket_id', 'referenced' => 'baskets'],
    ];

    public function up(): void
    {
        if (Schema::getConnection()->getDriverName() !== 'pgsql') {
            // SQLite (test environment) cannot alter FK actions in place and
            // enforces foreign_keys per connection config; hardening is a
            // production-data-protection concern and is a documented no-op there.
            return;
        }

        foreach (self::HARDENED_FOREIGN_KEYS as $fk) {
            $constraint = $this->findConstraintName($fk['table'], $fk['column']);
            if ($constraint === null) {
                throw new RuntimeException("Foreign key constraint on {$fk['table']}.{$fk['column']} not found — aborting instead of guessing.");
            }

            // Orphan records would make a RESTRICT swap itself fail on re-validation;
            // surface them as a hard stop. Nothing is deleted.
            $orphans = DB::selectOne(
                "SELECT COUNT(*) AS n FROM {$fk['table']} t LEFT JOIN {$fk['referenced']} r ON r.id = t.{$fk['column']}
                 WHERE t.{$fk['column']} IS NOT NULL AND r.id IS NULL"
            )->n;
            if ($orphans > 0) {
                throw new RuntimeException(
                    "{$fk['table']}.{$fk['column']} has {$orphans} orphaned row(s) referencing missing {$fk['referenced']}. "
                    .'Resolve them before hardening this foreign key.'
                );
            }

            DB::statement("ALTER TABLE {$fk['table']} DROP CONSTRAINT {$constraint}");
            DB::statement(
                "ALTER TABLE {$fk['table']} ADD CONSTRAINT {$constraint}
                 FOREIGN KEY ({$fk['column']}) REFERENCES {$fk['referenced']}(id) ON DELETE RESTRICT"
            );
        }
    }

    public function down(): void
    {
        if (Schema::getConnection()->getDriverName() !== 'pgsql') {
            return;
        }

        foreach (self::HARDENED_FOREIGN_KEYS as $fk) {
            $constraint = $this->findConstraintName($fk['table'], $fk['column']);
            if ($constraint === null) {
                continue;
            }
            DB::statement("ALTER TABLE {$fk['table']} DROP CONSTRAINT {$constraint}");
            DB::statement(
                "ALTER TABLE {$fk['table']} ADD CONSTRAINT {$constraint}
                 FOREIGN KEY ({$fk['column']}) REFERENCES {$fk['referenced']}(id) ON DELETE CASCADE"
            );
        }
    }

    private function findConstraintName(string $table, string $column): ?string
    {
        $row = DB::selectOne(
            "SELECT con.conname
             FROM pg_constraint con
             JOIN pg_class rel ON rel.oid = con.conrelid
             JOIN unnest(con.conkey) AS k(attnum) ON true
             JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = k.attnum
             WHERE con.contype = 'f'
               AND rel.relname = ?
               AND att.attname = ?
               AND con.conrelid = to_regclass(?)
             LIMIT 1",
            [$table, $column, $table]
        );

        return $row->conname ?? null;
    }
};
