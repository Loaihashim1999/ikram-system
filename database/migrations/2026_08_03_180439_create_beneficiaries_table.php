<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
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

            // ... (الحقول السابقة تبقى كما هي)

            // 🔥 الحقول الاجتماعية والأسرية الجديدة
            $table->integer('family_members_count')->default(0); // عدد أفراد الأسرة
            $table->integer('working_members_count')->default(0); // عدد العاملين في الأسرة
            $table->integer('non_working_children_count')->default(0); // عدد الأبناء غير العاملين
            $table->enum('father_status', ['alive', 'deceased'])->default('alive'); // حالة الأب
            $table->enum('mother_status', ['alive', 'deceased'])->default('alive'); // حالة الأم

            // 🔥 الحقول المالية والسكنية
            $table->decimal('monthly_salary', 10, 2)->default(0); // الراتب الشهري
            $table->enum('housing_type', ['rent', 'own'])->default('rent'); // نوع السكن (إيجار/ملك)
            $table->decimal('social_security_amount', 10, 2)->default(0); // مبلغ الضمان الاجتماعي (للمواطن)
            $table->decimal('citizen_account_amount', 10, 2)->default(0); // مبلغ حساب المواطن (للمواطن)

// ... (rest of the code)
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('beneficiaries');
    }
};