<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Add financial columns to beneficiaries table if they don't exist
        Schema::table('beneficiaries', function (Blueprint $table) {
            if (! Schema::hasColumn('beneficiaries', 'monthly_rent')) {
                $table->decimal('monthly_rent', 10, 2)->default(0)->after('annual_rent_amount');
            }
            if (! Schema::hasColumn('beneficiaries', 'net_income')) {
                $table->decimal('net_income', 12, 2)->default(0)->after('total_income');
            }
        });

        // 2. Safely alter foreign key constraints to prevent accidental cascade deletion
        // On PostgreSQL, modify foreign keys on created_by and category_id
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('
                DO $$
                BEGIN
                    -- created_by constraint
                    IF EXISTS (
                        SELECT 1 FROM information_schema.table_constraints 
                        WHERE constraint_name = \'beneficiaries_created_by_foreign\' 
                        AND table_name = \'beneficiaries\'
                    ) THEN
                        ALTER TABLE beneficiaries DROP CONSTRAINT beneficiaries_created_by_foreign;
                        ALTER TABLE beneficiaries ADD CONSTRAINT beneficiaries_created_by_foreign 
                            FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
                    END IF;

                    -- category_id constraint
                    IF EXISTS (
                        SELECT 1 FROM information_schema.table_constraints 
                        WHERE constraint_name = \'beneficiaries_category_id_foreign\' 
                        AND table_name = \'beneficiaries\'
                    ) THEN
                        ALTER TABLE beneficiaries DROP CONSTRAINT beneficiaries_category_id_foreign;
                        ALTER TABLE beneficiaries ADD CONSTRAINT beneficiaries_category_id_foreign 
                            FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL;
                    END IF;
                END $$;
            ');
        }
    }

    public function down(): void
    {
        Schema::table('beneficiaries', function (Blueprint $table) {
            if (Schema::hasColumn('beneficiaries', 'monthly_rent')) {
                $table->dropColumn('monthly_rent');
            }
            if (Schema::hasColumn('beneficiaries', 'net_income')) {
                $table->dropColumn('net_income');
            }
        });
    }
};
