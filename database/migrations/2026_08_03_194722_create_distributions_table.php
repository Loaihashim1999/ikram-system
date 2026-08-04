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
    Schema::create('distributions', function (Blueprint $table) {
        $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
        $table->foreignUuid('beneficiary_id')->constrained('beneficiaries')->cascadeOnDelete();
        $table->foreignUuid('basket_id')->constrained('baskets')->cascadeOnDelete();
        $table->foreignUuid('assigned_by')->constrained('users')->cascadeOnDelete();
        $table->timestamp('scheduled_at');
        $table->string('pickup_location', 255)->nullable();
        $table->string('barcode_code', 100)->unique();
        $table->enum('status', ['scheduled', 'delivered', 'no_show', 'cancelled'])->default('scheduled');
        $table->enum('sms_status', ['sent', 'failed', 'pending'])->default('pending');
        $table->timestamp('delivered_at')->nullable();
        $table->timestamps();
    });
}

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('distributions');
    }
};
