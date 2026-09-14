<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('system_initializations', function (Blueprint $table) {
            $table->string('key')->primary();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
        });

        DB::table('system_initializations')->insert([
            'key' => 'first_admin',
            'completed_at' => DB::table('users')->where('role', 'admin')->exists() ? now() : null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('system_initializations');
    }
};
