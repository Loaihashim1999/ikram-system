<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pickup_locations', fn (Blueprint $t) => $t->string('location_url', 2048)->nullable());
        Schema::table('support_distributions', fn (Blueprint $t) => $t->string('pickup_location_url', 2048)->nullable());
        Schema::create('driver_assignments', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignUuid('driver_id')->constrained('drivers')->restrictOnDelete();
            $t->foreignUuid('created_by')->constrained('users')->restrictOnDelete();
            $t->string('token_hash', 64)->unique();
            $t->timestamp('expires_at');
            $t->timestamp('revoked_at')->nullable();
            $t->timestamp('completed_at')->nullable();
            $t->timestamp('last_used_at')->nullable();
            $t->timestamp('expiry_audited_at')->nullable();
            $t->timestamps();
        });
        Schema::create('driver_assignment_tasks', function (Blueprint $t) {
            $t->id();
            $t->foreignUuid('driver_assignment_id')->constrained()->restrictOnDelete();
            $t->foreignUuid('support_distribution_id')->unique()->constrained()->restrictOnDelete();
        });
        Schema::create('receipt_challenges', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignUuid('support_distribution_id')->unique()->constrained()->restrictOnDelete();
            $t->string('verifier', 64);
            $t->uuid('generation');
            $t->timestamp('expires_at');
            $t->unsignedInteger('failed_attempts')->default(0);
            $t->timestamp('locked_until')->nullable();
            $t->timestamp('consumed_at')->nullable();
            $t->timestamps();
        });
        Schema::create('support_receipts', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignUuid('support_distribution_id')->unique()->constrained()->restrictOnDelete();
            $t->foreignUuid('driver_assignment_id')->nullable()->constrained()->restrictOnDelete();
            $t->foreignUuid('confirmed_by')->constrained('users')->restrictOnDelete();
            $t->timestamp('confirmed_at');
            $t->timestamps();
        });
        Schema::create('communication_messages', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->string('idempotency_key')->unique();
            $t->string('channel', 20);
            $t->string('operation_type', 40);
            $t->string('operation_id', 100);
            $t->string('recipient_type', 30);
            $t->string('recipient_reference', 100);
            $t->string('destination');
            $t->text('encrypted_payload')->nullable();
            $t->timestamp('payload_expires_at');
            $t->string('status', 20)->default('pending')->index();
            $t->unsignedInteger('attempts')->default(0);
            $t->timestamp('next_attempt_at')->nullable();
            $t->string('provider_reference')->nullable();
            $t->string('error_code', 40)->nullable();
            $t->timestamp('requested_at');
            $t->timestamp('sent_at')->nullable();
            $t->timestamp('delivered_at')->nullable();
            $t->timestamp('failed_at')->nullable();
            $t->timestamps();
        });
    }

    public function down(): void
    {
        // Receipts and assignments are business history, never silently discard it.
        foreach (['support_receipts', 'driver_assignments', 'communication_messages', 'receipt_challenges'] as $table) {
            if (DB::table($table)->exists()) {
                throw new RuntimeException('Phase 2B rollback refused: delivery/communication history exists.');
            }
        }
        foreach (['communication_messages', 'support_receipts', 'receipt_challenges', 'driver_assignment_tasks', 'driver_assignments'] as $table) {
            Schema::dropIfExists($table);
        }
        Schema::table('support_distributions', fn (Blueprint $t) => $t->dropColumn('pickup_location_url'));
        Schema::table('pickup_locations', fn (Blueprint $t) => $t->dropColumn('location_url'));
    }
};
