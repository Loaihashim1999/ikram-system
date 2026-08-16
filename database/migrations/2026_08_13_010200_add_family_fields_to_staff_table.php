<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('staff', function (Blueprint $table) {
            $table->date('birth_date')->nullable()->after('name');
            $table->string('national_address', 255)->nullable()->after('phone');
            $table->unsignedSmallInteger('family_members_count')->default(0)->after('national_address');
            $table->unsignedTinyInteger('wives_count')->default(0)->after('family_members_count');
            $table->enum('father_status', ['alive', 'deceased'])->nullable()->after('wives_count');
            $table->enum('mother_status', ['alive', 'deceased'])->nullable()->after('father_status');
            $table->boolean('owns_house')->default(false)->after('mother_status');
        });
    }

    public function down(): void
    {
        Schema::table('staff', function (Blueprint $table) {
            $table->dropColumn([
                'birth_date', 'national_address', 'family_members_count',
                'wives_count', 'father_status', 'mother_status', 'owns_house',
            ]);
        });
    }
};
