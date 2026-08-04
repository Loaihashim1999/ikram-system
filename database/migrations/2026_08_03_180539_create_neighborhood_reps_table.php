<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
{
    Schema::create('neighborhood_reps', function (Blueprint $table) {
        $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
        $table->string('full_name', 150);
        $table->string('phone', 20);
        $table->text('id_document_image_url')->nullable();
        $table->string('district_name', 100);
        $table->decimal('district_location_lat', 10, 7)->nullable();
        $table->decimal('district_location_lng', 10, 7)->nullable();
        $table->integer('beneficiaries_count')->default(0);
        $table->text('support_letter_url')->nullable();
        $table->timestamps();
    });
}

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('neighborhood_reps');
    }
};
