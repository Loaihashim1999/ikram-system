<?php

use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        // Policy evidence codes are separate from document storage types.
        // PolicyConfigurationValidator maps additional evidence to the existing
        // additional_document type, so no enum extension is required.
    }

    public function down(): void
    {
        // No destructive change to existing enum data; revert handled by validator.
    }
};
