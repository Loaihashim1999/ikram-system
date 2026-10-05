<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('communication_template_versions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('internal_key', 80)->index();
            $table->unsignedInteger('version');
            $table->string('provider_template_name', 150)->unique();
            $table->text('body');
            $table->string('language', 12)->default('ar');
            $table->string('category', 30)->default('UTILITY');
            $table->string('provider_template_id')->nullable()->index();
            $table->string('provider_status', 30)->default('DRAFT')->index();
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('last_synced_at')->nullable();
            $table->timestamp('activated_at')->nullable();
            $table->timestamp('deactivated_at')->nullable();
            $table->timestamp('provider_deleted_at')->nullable();
            $table->foreignUuid('created_by')->constrained('users')->restrictOnDelete();
            $table->timestamps();
            $table->unique(['internal_key', 'version']);
        });
    }

    public function down(): void
    {
        if (DB::table('communication_template_versions')->exists()) {
            throw new RuntimeException('Rollback refused: communication template history exists.');
        }
        Schema::dropIfExists('communication_template_versions');
    }
};
