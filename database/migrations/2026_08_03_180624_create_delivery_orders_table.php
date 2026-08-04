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
    Schema::create('delivery_orders', function (Blueprint $table) {
        $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
        $table->foreignUuid('driver_id')->constrained('drivers')->cascadeOnDelete();
        $table->foreignUuid('beneficiary_id')->constrained('beneficiaries')->cascadeOnDelete();
        $table->foreignUuid('basket_id')->constrained('baskets')->cascadeOnDelete();
        $table->string('delivery_location', 255);
        $table->timestamp('scheduled_at');
        $table->string('beneficiary_phone', 20);
        $table->string('barcode_code', 100)->unique();
        $table->enum('status', ['assigned', 'out_for_delivery', 'delivered', 'confirmed'])->default('assigned');
        $table->timestamp('delivered_at')->nullable();
        $table->foreignUuid('confirmed_by')->nullable()->constrained('users')->nullOnDelete();
        $table->timestamp('confirmed_at')->nullable();
        $table->timestamps();
    });
}

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('delivery_orders');
    }
};
