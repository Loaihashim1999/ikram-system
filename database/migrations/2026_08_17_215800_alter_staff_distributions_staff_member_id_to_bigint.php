<?php

use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        // Preserve legacy UUID references. Numeric staff links use the separate
        // staff_id column added by the later migration.
    }

    public function down(): void
    {
        // Never erase or cast historical staff references on rollback.
    }
};
