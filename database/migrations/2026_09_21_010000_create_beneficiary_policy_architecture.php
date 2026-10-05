<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * POLICY-A — Beneficiary Policy Engine: policy versioning & evaluation snapshots.
 *
 * Additive, reversible, PostgreSQL-compatible.
 * - JSONB is used on PostgreSQL (strict config / snapshots); `json` on SQLite.
 * - Existing beneficiary classification columns are untouched.
 * - Backstop constraints (checked dates, one published per scope+effective_from)
 *   are PostgreSQL-only partial constraints; lifecycle invariants are also
 *   enforced at the service layer so SQLite/tests behave identically.
 */
return new class extends Migration
{
    private function driver(): string
    {
        return Schema::getConnection()->getDriverName();
    }

    private function jsonType(): string
    {
        return $this->driver() === 'pgsql' ? 'jsonb' : 'json';
    }

    public function up(): void
    {
        Schema::create('beneficiary_policy_versions', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->string('policy_name', 150);
            $t->string('policy_scope', 80)->default('citizen_beneficiaries');
            $t->string('version', 30);
            $t->enum('status', ['draft', 'published', 'retired'])->default('draft');
            $t->date('effective_from')->nullable();
            $t->date('effective_to')->nullable();
            $t->string('source_document_reference', 255)->nullable();
            $t->string('source_document_version', 50)->nullable();
            $t->string('board_approval_reference', 150)->nullable();
            $t->date('board_approval_date')->nullable();
            $this->jsonColumn($t, 'configuration');
            // Self-referencing lineage FK is added in a second pass below:
            // PostgreSQL requires the referenced primary key to exist before the
            // constraint is declared (PK is emitted as a table-level constraint).
            $t->uuid('parent_version_id')->nullable();
            $t->foreignUuid('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamp('approved_at')->nullable();
            $t->foreignUuid('published_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamp('published_at')->nullable();
            $t->foreignUuid('retired_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamp('retired_at')->nullable();
            $t->text('change_reason')->nullable();
            $t->timestamps();

            $t->unique(['policy_name', 'version']);
            $t->index(['policy_scope', 'status']);
        });

        // Second pass: self-referencing lineage FK (see note above).
        Schema::table('beneficiary_policy_versions', function (Blueprint $t) {
            $t->foreign('parent_version_id')->references('id')->on('beneficiary_policy_versions')->nullOnDelete();
        });

        Schema::create('beneficiary_policy_evaluations', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignUuid('beneficiary_id')->nullable()->constrained('beneficiaries')->nullOnDelete();
            $t->foreignUuid('policy_version_id')->constrained('beneficiary_policy_versions')->restrictOnDelete();
            $t->enum('evaluation_status', ['completed', 'failed'])->default('completed');
            $t->timestamp('evaluated_at')->useCurrent();
            $t->foreignUuid('evaluated_by')->nullable()->constrained('users')->nullOnDelete();
            $this->jsonColumn($t, 'input_snapshot');
            $this->jsonColumn($t, 'financial_snapshot');
            $this->jsonColumn($t, 'scoring_snapshot');
            $t->decimal('gross_counted_income', 14, 2)->nullable();
            $t->decimal('monthly_rent', 14, 2)->nullable();
            $t->unsignedInteger('family_size')->nullable();
            $t->decimal('family_member_deduction', 14, 2)->nullable();
            $t->decimal('adjusted_net_household_income', 14, 2)->nullable();
            $t->decimal('net_income_per_capita', 14, 2)->nullable();
            $t->string('income_category', 50)->nullable();
            $t->decimal('policy_score', 12, 4)->nullable();
            $t->string('score_category', 50)->nullable();
            $this->jsonColumn($t, 'degree_classification_snapshot');
            $this->jsonColumn($t, 'need_level_snapshot');
            $t->string('exception_code', 60)->nullable();
            $t->text('exception_details')->nullable();
            $t->string('final_policy_decision', 60)->nullable();
            $t->text('decision_reason')->nullable();
            $t->timestamps();

            $t->index(['beneficiary_id', 'policy_version_id']);
        });

        if ($this->driver() === 'pgsql') {
            // Effective period must be ordered when both bounds are present.
            DB::statement(
                'ALTER TABLE beneficiary_policy_versions ADD CONSTRAINT beneficiary_policy_versions_dates_ordered '
                .'CHECK (effective_to IS NULL OR (effective_from IS NOT NULL AND effective_to >= effective_from))'
            );
            // PostgreSQL backstop: a published policy version may not share its
            // scope + effective_from start with another published version.
            DB::statement(
                'CREATE UNIQUE INDEX beneficiary_policy_versions_one_published_per_scope_start '
                .'ON beneficiary_policy_versions (policy_scope, effective_from) '
                ."WHERE status = 'published' AND effective_from IS NOT NULL"
            );
        }
    }

    public function down(): void
    {
        if ($this->driver() === 'pgsql') {
            DB::statement('DROP INDEX IF EXISTS beneficiary_policy_versions_one_published_per_scope_start');
            DB::statement('ALTER TABLE beneficiary_policy_versions DROP CONSTRAINT IF EXISTS beneficiary_policy_versions_dates_ordered');
        }
        Schema::dropIfExists('beneficiary_policy_evaluations');
        Schema::dropIfExists('beneficiary_policy_versions');
    }

    private function jsonColumn(Blueprint $t, string $name): void
    {
        $t->{$this->jsonType()}($name)->nullable();
    }
};
