<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('staff_dependents', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->unsignedBigInteger('staff_id');
            $table->foreign('staff_id')->references('id')->on('staff')->cascadeOnDelete();
            $table->string('name', 200);
            $table->string('relationship', 100)->nullable();
            $table->date('date_of_birth')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('staff_dependents');
    }
};
