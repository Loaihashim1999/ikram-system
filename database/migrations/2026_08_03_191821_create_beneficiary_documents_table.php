<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('beneficiary_documents', function (Blueprint $table) {
            $idCol = $table->uuid('id')->primary();
            if (Schema::getConnection()->getDriverName() === 'pgsql') {
                $idCol->default(\DB::raw('gen_random_uuid()'));
            }
            $table->foreignUuid('beneficiary_id')->constrained('beneficiaries')->cascadeOnDelete();

            // نوع الوثيقة
            $table->enum('document_type', [
                'national_id',           // هوية وطنية
                'residence_id',          // إقامة
                'citizen_account',       // حساب مواطن
                'social_security',       // ضمان اجتماعي
                'additional_document',    // مستند إضافي
            ]);

            // مسار الملف
            $table->text('file_url');
            $table->string('file_type', 20)->default('image'); // image أو pdf

            // بيانات OCR إذا وجدت
            $table->json('ocr_data')->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('beneficiary_documents');
    }
};
