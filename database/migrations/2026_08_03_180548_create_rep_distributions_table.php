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
        Schema::create('rep_distributions', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->foreignUuid('rep_id')->constrained('neighborhood_reps')->cascadeOnDelete();
            $table->foreignUuid('basket_id')->constrained('baskets')->cascadeOnDelete();
            $table->integer('basket_count')->default(1);
            $table->integer('target_beneficiaries_count')->default(0);
            $table->timestamp('scheduled_at');
            $table->string('barcode_code', 100)->unique();
            $table->enum('status', ['scheduled', 'picked_up', 'distributed'])->default('scheduled');
            $table->timestamp('picked_up_at')->nullable();
            $table->boolean('is_documented')->default(false);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('rep_distributions');
    }
};
