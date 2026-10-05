<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('social_assessments', function (Blueprint $table) {
            $idCol = $table->uuid('id')->primary();
            if (Schema::getConnection()->getDriverName() === 'pgsql') {
                $idCol->default(DB::raw('gen_random_uuid()'));
            }

            $table->foreignUuid('beneficiary_id')
                ->constrained('beneficiaries')
                ->cascadeOnDelete();
            $table->foreignUuid('policy_version_id')
                ->nullable()
                ->constrained('beneficiary_policy_versions')
                ->nullOnDelete();
            $table->foreignUuid('evaluation_id')
                ->nullable()
                ->constrained('beneficiary_policy_evaluations')
                ->nullOnDelete();

            $table->string('researcher_type', 50)->nullable();
            $table->foreignUuid('researcher_id')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->date('assessment_date');
            $table->string('housing_condition', 20)->nullable();
            $table->string('service_area_result', 30)->nullable();
            $table->string('landlord_relationship_result', 40)->nullable();
            $table->json('household_findings')->nullable();
            $table->string('structured_recommendation', 20)->nullable();
            $table->text('controlled_notes')->nullable();

            $table->enum('status', ['draft', 'submitted', 'reviewed']);

            $table->string('created_by', 36)->nullable();
            $table->string('updated_by', 36)->nullable();
            $table->timestamps();

            $table->index('beneficiary_id');
            $table->index('evaluation_id');
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('social_assessments');
    }
};
