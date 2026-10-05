<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('document_verifications', function (Blueprint $table) {
            $idCol = $table->uuid('id')->primary();
            if (Schema::getConnection()->getDriverName() === 'pgsql') {
                $idCol->default(DB::raw('gen_random_uuid()'));
            }

            $table->foreignUuid('beneficiary_id')
                ->nullable()
                ->constrained('beneficiaries')
                ->nullOnDelete();
            $table->foreignUuid('document_id')
                ->nullable()
                ->constrained('beneficiary_documents')
                ->nullOnDelete();
            $table->foreignUuid('evaluation_id')
                ->nullable()
                ->constrained('beneficiary_policy_evaluations')
                ->nullOnDelete();

            $table->string('document_code', 40); // e.g. death_certificate, divorce_deed, dependency_deed, medical_evidence, housing_condition_assessment
            $table->string('verification_status', 30); // verified, rejected, missing, under_review, expired
            $table->string('verified_by', 36)->nullable(); // user reference or structured string
            $table->dateTime('verified_at')->nullable();
            $table->text('rejection_reason')->nullable();
            $table->text('evidence_reference')->nullable(); // reference to file URL or assessment, NOT binary

            $table->timestamps();

            $table->index('beneficiary_id');
            $table->index('evaluation_id');
            $table->index('document_code');
            $table->index('verification_status');
        });

        Schema::create('medical_evidence', function (Blueprint $table) {
            $idCol = $table->uuid('id')->primary();
            if (Schema::getConnection()->getDriverName() === 'pgsql') {
                $idCol->default(DB::raw('gen_random_uuid()'));
            }

            $table->foreignUuid('beneficiary_id')
                ->constrained('beneficiaries')
                ->cascadeOnDelete();
            $table->foreignUuid('evaluation_id')
                ->nullable()
                ->constrained('beneficiary_policy_evaluations')
                ->nullOnDelete();

            // Verified disability percentage from authoritative structured evidence only
            $table->decimal('verified_disability_percentage', 5, 2)
                ->nullable()
                ->check('verified_disability_percentage >= 0 and verified_disability_percentage <= 100');
            $table->string('verification_status', 30); // verified, rejected, missing, under_review
            $table->string('verified_by', 36)->nullable();
            $table->dateTime('verified_at')->nullable();
            $table->text('evidence_reference')->nullable(); // document/file reference, NOT binary
            $table->text('rejection_reason')->nullable();
            $table->text('medical_notes')->nullable();

            $table->timestamps();
            $table->index('evaluation_id');
            $table->index('verification_status');
        });

        Schema::create('policy_decisions', function (Blueprint $table) {
            $idCol = $table->uuid('id')->primary();
            if (Schema::getConnection()->getDriverName() === 'pgsql') {
                $idCol->default(DB::raw('gen_random_uuid()'));
            }

            $table->foreignUuid('evaluation_id')
                ->constrained('beneficiary_policy_evaluations')
                ->cascadeOnDelete();
            $table->string('policy_version_id', 36);
            $table->string('decision', 20); // approved, rejected
            $table->string('decided_by', 36)->nullable();
            $table->dateTime('decided_at');
            $table->string('stable_reason_code', 60)->nullable();
            $table->text('human_readable_reason')->nullable();
            $table->json('evidence_summary_reference')->nullable(); // structured references only, NOT binaries

            $table->timestamps();
            $table->index('evaluation_id');
            $table->index('decision');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('policy_decisions');
        Schema::dropIfExists('medical_evidence');
        Schema::dropIfExists('document_verifications');
    }
};
