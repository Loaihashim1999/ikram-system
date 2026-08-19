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
        Schema::create('staff_distributions', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->foreignUuid('staff_member_id')->constrained('staff_members')->cascadeOnDelete();
            $table->foreignUuid('basket_id')->constrained('baskets')->cascadeOnDelete();
            $table->timestamp('scheduled_at');
            $table->string('barcode_code', 100)->unique();
            $table->enum('status', ['scheduled', 'delivered', 'cancelled'])->default('scheduled');
            $table->timestamp('delivered_at')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('staff_distributions');
    }
};
