<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('beneficiaries', function (Blueprint $table) {
            $table->timestamp('confirmed_at')->nullable();
            $table->foreignUuid('confirmed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('archived_at')->nullable()->index();
            $table->foreignUuid('archived_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('archive_reason', 500)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('beneficiaries', function (Blueprint $table) {
            $table->dropForeign(['confirmed_by']);
            $table->dropForeign(['archived_by']);
            $table->dropColumn(['confirmed_at', 'confirmed_by', 'archived_at', 'archived_by', 'archive_reason']);
        });
    }
};
