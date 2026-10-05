<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Password-recovery OTP challenges (6-digit SMS codes).
 * Completely separate from the 4-digit receipt verification challenges:
 * own table, own HMAC namespace (`password_reset:`), own attempts/lock state.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('password_reset_challenges', function (Blueprint $table) {
            $idCol = $table->uuid('id')->primary();
            if (Schema::getConnection()->getDriverName() === 'pgsql') {
                $idCol->default(DB::raw('gen_random_uuid()'));
            }
            $table->uuid('user_id')->unique();
            $table->uuid('generation');
            $table->string('verifier', 64);
            $table->uuid('channel_message_id')->nullable();
            $table->string('recovery_token_hash', 64)->nullable();
            $table->timestamp('otp_expires_at');
            $table->timestamp('last_sent_at');
            $table->unsignedTinyInteger('failed_attempts')->default(0);
            $table->unsignedSmallInteger('send_count')->default(0);
            $table->timestamp('send_window_start')->nullable();
            $table->timestamp('locked_until')->nullable();
            $table->timestamp('verified_at')->nullable();
            $table->timestamp('recovery_expires_at')->nullable();
            $table->timestamp('consumed_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('password_reset_challenges');
    }
};
