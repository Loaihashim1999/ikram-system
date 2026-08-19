<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('staff')) {
            Schema::create('staff', function (Blueprint $table) {
                $table->id();
                $table->string('name');                              // اسم الموظف
                $table->string('national_id', 10)->unique();         // رقم الهوية
                $table->string('phone', 20);                         // رقم الهاتف
                $table->string('email')->nullable()->unique();       // البريد الإلكتروني
                $table->string('job_title');                         // المسمى الوظيفي
                $table->string('department')->nullable();            // القسم
                $table->date('hire_date');                           // تاريخ التعيين
                $table->decimal('salary', 10, 2)->nullable()->default(0); // الراتب
                $table->enum('status', ['active', 'on_leave', 'terminated'])->default('active');
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('staff');
    }
};
