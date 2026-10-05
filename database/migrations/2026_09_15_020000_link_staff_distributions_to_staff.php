<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $type = Schema::getColumnType('staff_distributions', 'staff_member_id');
        if (Schema::getConnection()->getDriverName() === 'pgsql' && ! in_array($type, ['uuid', 'int8', 'bigint'], true)) {
            throw new RuntimeException('Unsupported legacy staff reference type; manual review required.');
        }

        Schema::table('staff_distributions', function (Blueprint $table) use ($type) {
            if (in_array($type, ['int8', 'bigint'], true)) {
                $table->bigInteger('staff_member_id')->nullable()->change();
            } else {
                $table->uuid('staff_member_id')->nullable()->change();
            }

            $table->foreignId('staff_id')->nullable()->after('staff_member_id')->constrained('staff')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('staff_distributions', function (Blueprint $table) {
            $table->dropConstrainedForeignId('staff_id');
        });
    }
};
