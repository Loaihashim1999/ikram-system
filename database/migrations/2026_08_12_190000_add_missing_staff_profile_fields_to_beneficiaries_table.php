<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
       Schema::create('staff', function (Blueprint $table) {
    $table->id();
    $table->string('name');
    $table->string('national_id')->unique();   // رقم الهوية
    $table->string('phone');
    $table->string('email')->nullable();
    $table->string('job_title');               // المسمى الوظيفي
    $table->string('department')->nullable();  // القسم
    $table->date('hire_date');                 // تاريخ التعيين
    $table->decimal('salary', 10, 2)->nullable();
    $table->enum('status', ['active', 'on_leave', 'terminated'])->default('active');
    $table->timestamps();
       });
}
    

    public function down(): void
    {
        Schema::dropIfExists('staff');
        
    }
};