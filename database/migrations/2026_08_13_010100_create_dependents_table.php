<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('dependents', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('beneficiary_id');
            $table->foreign('beneficiary_id')
                  ->references('id')->on('beneficiaries')
                  ->cascadeOnDelete();
            $table->string('name', 200);
            $table->string('relationship', 100)->nullable(); // ابن، بنت، زوجة، أم، أب...
            $table->date('date_of_birth')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('dependents');
    }
};
