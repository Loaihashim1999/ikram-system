<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
   <?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
 Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('beneficiaries', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            
            // نوع المستفيد
            $table->enum('beneficiary_type', ['citizen', 'resident'])->default('citizen');
            
            // البيانات الأساسية
            $table->string('full_name', 150);
            $table->string('national_id', 20)->unique(); // رقم الهوية أو الإقامة
            $table->string('phone', 20);
            $table->date('date_of_birth')->nullable(); // من OCR
            $table->string('place_of_birth', 100)->nullable(); // من OCR
            
            // العنوان
            $table->string('city', 100)->nullable();
            $table->string('district', 100)->nullable();
            $table->string('street', 150)->nullable();
            
            // 🔥 بيانات OCR المستخرجة
            $table->json('ocr_extracted_data')->nullable(); // جميع البيانات المستخرجة من OCR
            
            // 📄 وثائق المواطنين
            $table->text('national_id_image_url')->nullable(); // صورة الهوية الوطنية
            $table->text('citizen_account_image_url')->nullable(); // صورة حساب المواطن
            $table->text('social_security_image_url')->nullable(); // صورة الضمان الاجتماعي
            $table->string('citizen_account_number', 50)->nullable(); // رقم حساب المواطن
            $table->string('social_security_number', 50)->nullable(); // رقم الضمان الاجتماعي
            
            //  وثائق المقيمين
            $table->text('residence_id_image_url')->nullable(); // صورة الإقامة
            $table->date('residence_issue_date')->nullable(); // تاريخ إصدار الإقامة (من OCR)
            $table->date('residence_expiry_date')->nullable(); // تاريخ انتهاء الإقامة (من OCR)
            $table->string('nationality', 100)->nullable(); // الجنسية (للمقيم)
            $table->string('profession', 100)->nullable(); // المهنة (للمقيم)
            
            // بيانات إضافية
            $table->string('additional_document_number', 50)->nullable();
            $table->foreignUuid('category_id')->constrained('categories')->cascadeOnDelete();
            $table->boolean('has_special_needs')->default(false);
            $table->enum('status', ['active', 'suspended', 'under_review'])->default('active');
            $table->foreignUuid('created_by')->constrained('users')->cascadeOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('beneficiaries');
    }
};

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('beneficiaries');
    }
};
