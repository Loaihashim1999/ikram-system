<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('support_distributions', function (Blueprint $table) {
            $idCol = $table->uuid('id')->primary();
            if (Schema::getConnection()->getDriverName() === 'pgsql') {
                $idCol->default(DB::raw('gen_random_uuid()'));
            }
            // Recipient: exactly one of the three is set, enforced by validation,
            // service layer, and (on PostgreSQL) CHECK constraints below.
            $table->string('recipient_type', 20)->index(); // beneficiary | staff | organization
            $table->foreignUuid('beneficiary_id')->nullable()->constrained('beneficiaries')->restrictOnDelete();
            $table->foreignId('staff_id')->nullable()->constrained('staff')->restrictOnDelete();
            $table->foreignUuid('organization_id')->nullable()->constrained('organizations')->restrictOnDelete();
            // Historical snapshots — the original entity remains authoritative for
            // identity data; only non-sensitive business references are copied here.
            $table->string('recipient_name', 200);
            $table->string('recipient_reference', 100)->nullable();

            $table->foreignUuid('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignUuid('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->enum('fulfillment_method', ['pickup', 'delivery']);
            $table->foreignUuid('pickup_location_id')->nullable()->constrained('pickup_locations')->restrictOnDelete();
            $table->string('pickup_location_name', 200)->nullable();
            $table->string('status', 20)->default('draft')->index(); // draft|approved|reserved|ready|in_delivery|completed|cancelled
            $table->foreignUuid('driver_id')->nullable()->constrained('drivers')->nullOnDelete();
            $table->timestamp('support_date')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->string('cancellation_reason', 255)->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        if (Schema::getConnection()->getDriverName() === 'pgsql') {
            DB::statement("
                ALTER TABLE support_distributions
                ADD CONSTRAINT support_distributions_recipient_integrity CHECK (
                    (recipient_type = 'beneficiary' AND beneficiary_id IS NOT NULL AND staff_id IS NULL AND organization_id IS NULL)
                    OR (recipient_type = 'staff' AND staff_id IS NOT NULL AND beneficiary_id IS NULL AND organization_id IS NULL)
                    OR (recipient_type = 'organization' AND organization_id IS NOT NULL AND beneficiary_id IS NULL AND staff_id IS NULL)
                )
            ");
        }
    }

    public function down(): void
    {
        if (Schema::getConnection()->getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE support_distributions DROP CONSTRAINT IF EXISTS support_distributions_recipient_integrity');
        }
        Schema::dropIfExists('support_distributions');
    }
};
