<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('beneficiaries', function (Blueprint $table) {
            // التصنيف: درجة أولى / درجة ثانية / ذوو احتياجات خاصة / كبار السن
            $table->string('priority', 30)->nullable()->after('status');
            // إجمالي الدخل المحسوب (يُحدَّث تلقائياً عند الحفظ)
            $table->decimal('total_income', 12, 2)->nullable()->after('priority');
        });
    }

    public function down(): void
    {
        Schema::table('beneficiaries', function (Blueprint $table) {
            $table->dropColumn(['priority', 'total_income']);
        });
    }
};
