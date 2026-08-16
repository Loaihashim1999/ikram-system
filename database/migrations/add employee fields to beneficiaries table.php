<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('beneficiaries', function (Blueprint $table) {
            // الحقول الوظيفية
            $table->string('job_title')->nullable()->after('is_employee');
            $table->string('job_sector')->nullable()->after('job_title');
            $table->string('nationality')->default('سعودي')->after('job_sector');
            
            // بيانات الأسرة الإضافية
            $table->integer('wives_count')->default(0)->after('non_working_children_count');
            $table->boolean('owns_house')->default(false)->after('wives_count');
            
            // صور الوثائق
            $table->string('national_address_image_url')->nullable()->after('social_security_image_url');
            $table->string('rental_contract_image_url')->nullable()->after('national_address_image_url');
        });
    }

    public function down(): void
    {
        Schema::table('beneficiaries', function (Blueprint $table) {
            $table->dropColumn([
                'job_title', 'job_sector', 'nationality',
                'wives_count', 'owns_house',
                'national_address_image_url', 'rental_contract_image_url'
            ]);
        });
    }
};