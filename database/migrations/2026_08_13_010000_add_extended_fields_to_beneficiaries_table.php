<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // Columns already in DB (from previous migrations): wives_count, owns_house, etc.
    // This migration only adds what is genuinely missing.

    public function up(): void
    {
        Schema::table('beneficiaries', function (Blueprint $table) {
            // الحالة الأسرية (جديد)
            if (! Schema::hasColumn('beneficiaries', 'family_status')) {
                $table->enum('family_status', [
                    'poor', 'widow', 'widow_with_orphans',
                    'divorced', 'divorced_with_children', 'abandoned',
                ])->nullable()->after('status');
            }

            // مبلغ الإيجار السنوي (جديد)
            if (! Schema::hasColumn('beneficiaries', 'annual_rent_amount')) {
                $table->decimal('annual_rent_amount', 10, 2)->default(0)->after('housing_type');
            }

            // مصادر الدخل (JSON) (جديد)
            if (! Schema::hasColumn('beneficiaries', 'income_sources')) {
                $table->json('income_sources')->nullable()->after('annual_rent_amount');
            }

            // راتب التقاعد (جديد)
            if (! Schema::hasColumn('beneficiaries', 'retirement_pension')) {
                $table->decimal('retirement_pension', 10, 2)->default(0);
            }

            // دعم الأسرة للمقيم (جديد)
            if (! Schema::hasColumn('beneficiaries', 'family_support')) {
                $table->decimal('family_support', 10, 2)->default(0);
            }

            // اسم البنك (جديد)
            if (! Schema::hasColumn('beneficiaries', 'bank_name')) {
                $table->string('bank_name', 100)->nullable();
            }

            // رقم الآيبان مشفر (جديد)
            if (! Schema::hasColumn('beneficiaries', 'iban_encrypted')) {
                $table->text('iban_encrypted')->nullable();
            }

            // فاتورة الكهرباء (جديد)
            if (! Schema::hasColumn('beneficiaries', 'electricity_bill_image_url')) {
                $table->text('electricity_bill_image_url')->nullable();
            }

            // شهادة الراتب (جديد)
            if (! Schema::hasColumn('beneficiaries', 'salary_certificate_url')) {
                $table->text('salary_certificate_url')->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('beneficiaries', function (Blueprint $table) {
            $columns = [
                'family_status', 'annual_rent_amount', 'income_sources',
                'retirement_pension', 'family_support', 'bank_name',
                'iban_encrypted', 'electricity_bill_image_url', 'salary_certificate_url',
            ];
            foreach ($columns as $col) {
                if (Schema::hasColumn('beneficiaries', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
