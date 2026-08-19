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
        Schema::create('notifications', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->enum('recipient_type', ['beneficiary', 'staff', 'rep', 'driver']);
            $table->uuid('recipient_id');
            $table->string('related_record_type', 50);
            $table->uuid('related_record_id');
            $table->text('message_body');
            $table->enum('status', ['sent', 'failed', 'pending'])->default('pending');
            $table->text('provider_response')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('notifications');
    }
};
