<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * POLICY-E1 — application-scope run ledger foundation. Additive only.
 *
 * FK choices (audit/history preservation contract):
 * - runs.policy_version_id → beneficiary_policy_versions RESTRICT: a published
 *   version with application runs must never be deletable.
 * - runs actor columns → users NULL on delete: removing a human actor must not
 *   erase historical runs.
 * - items.run_id → policy_application_runs CASCADE: items are meaningless
 *   without their run; the version-level restrict protects the chain.
 * - items.beneficiary_id → beneficiaries RESTRICT: beneficiaries referenced by
 *   run items are audit history and must not be deleted.
 * - items.source/new_evaluation_id → beneficiary_policy_evaluations NULL on
 *   delete: evaluation snapshots are immutable; references soften.
 *
 * Status/counter CHECK constraints are enforced by PostgreSQL and SQLite; the
 * model state machines are the primary guard.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('policy_application_runs', function (Blueprint $table) {
            $idCol = $table->uuid('id')->primary();
            if (Schema::getConnection()->getDriverName() === 'pgsql') {
                $idCol->default(DB::raw('gen_random_uuid()'));
            }

            $table->foreignUuid('policy_version_id')
                ->constrained('beneficiary_policy_versions')
                ->restrictOnDelete();

            // One of PolicyConfigurationValidator::APPLICATION_SCOPES.
            $table->string('scope_mode', 40);
            // Normalized run-level parameters (e.g. deduped/sorted beneficiary_ids
            // for selected_existing_and_new, canonical effective_from_date). Never
            // contains secrets, documents, IBAN or national IDs.
            $table->jsonb('scope_parameters')->nullable();

            // enum compiles to a real CHECK constraint on SQLite and PostgreSQL.
            $table->enum('status', ['draft', 'simulated', 'approved_for_execution', 'running', 'completed', 'completed_with_errors', 'failed', 'cancelled'])
                ->default('draft');

            // sha256 over policy_version_id + scope_mode + normalized parameters.
            $table->string('simulation_fingerprint', 64)->nullable();
            // Populated by POLICY-E2; proves execution acts on the reviewed set.
            $table->string('candidate_set_hash', 64)->nullable();

            $table->foreignUuid('requested_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignUuid('simulation_created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignUuid('execution_requested_by')->nullable()->constrained('users')->nullOnDelete();

            $table->dateTime('simulated_at')->nullable();
            $table->dateTime('execution_started_at')->nullable();
            $table->dateTime('completed_at')->nullable();
            $table->dateTime('cancelled_at')->nullable();

            $table->unsignedInteger('total_candidates')->default(0);
            $table->unsignedInteger('processed_count')->default(0);
            $table->unsignedInteger('success_count')->default(0);
            $table->unsignedInteger('review_count')->default(0);
            $table->unsignedInteger('not_applicable_count')->default(0);
            $table->unsignedInteger('failed_count')->default(0);

            $table->timestamps();

            $table->index('policy_version_id');
            $table->index('status');
        });

        Schema::create('policy_application_run_items', function (Blueprint $table) {
            $idCol = $table->uuid('id')->primary();
            if (Schema::getConnection()->getDriverName() === 'pgsql') {
                $idCol->default(DB::raw('gen_random_uuid()'));
            }

            $table->foreignUuid('run_id')
                ->constrained('policy_application_runs')
                ->cascadeOnDelete();
            $table->foreignUuid('beneficiary_id')
                ->constrained('beneficiaries')
                ->restrictOnDelete();

            // enum compiles to a real CHECK constraint on SQLite and PostgreSQL.
            $table->enum('status', ['pending', 'simulated', 'processing', 'completed', 'review_required', 'not_applicable', 'failed', 'cancelled'])
                ->default('pending');

            $table->foreignUuid('source_evaluation_id')
                ->nullable()
                ->constrained('beneficiary_policy_evaluations')
                ->nullOnDelete();
            $table->foreignUuid('new_evaluation_id')
                ->nullable()
                ->constrained('beneficiary_policy_evaluations')
                ->nullOnDelete();

            // Sanitized simulation snapshot (POLICY-E2). Structured references
            // only — never documents, IBAN, national ID or medical data.
            $table->jsonb('simulation_result')->nullable();
            // Hash of the beneficiary source state at simulation time (E2/E3).
            $table->string('source_state_marker', 64)->nullable();

            $table->string('failure_code', 60)->nullable();
            $table->text('failure_details')->nullable(); // sanitized only
            $table->unsignedInteger('attempt_count')->default(0);

            $table->dateTime('processed_at')->nullable();
            $table->timestamps();

            // Required idempotency backstop: one row per beneficiary per run.
            $table->unique(['run_id', 'beneficiary_id']);
            $table->index('beneficiary_id');
            $table->index('status');
        });

        // Non-negative counter backstops. SQLite cannot ADD a CHECK after table
        // creation, so these are PostgreSQL-only (proven on the Phase-2A QA
        // database); the model state machines guard counters on every driver.
        if (Schema::getConnection()->getDriverName() === 'pgsql') {
            foreach (['total_candidates', 'processed_count', 'success_count', 'review_count', 'not_applicable_count', 'failed_count'] as $counter) {
                DB::statement("ALTER TABLE policy_application_runs ADD CONSTRAINT policy_application_runs_{$counter}_non_negative CHECK ({$counter} >= 0)");
            }
            DB::statement('ALTER TABLE policy_application_run_items ADD CONSTRAINT policy_application_run_items_attempt_count_non_negative CHECK (attempt_count >= 0)');
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('policy_application_run_items');
        Schema::dropIfExists('policy_application_runs');
    }
};
