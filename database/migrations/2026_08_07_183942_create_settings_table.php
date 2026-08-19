<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('settings', function (Blueprint $table) {
            $idCol = $table->uuid('id')->primary();
            if (Schema::getConnection()->getDriverName() === 'pgsql') {
                $idCol->default(\DB::raw('gen_random_uuid()'));
            }
            $table->string('key', 100)->unique(); // مثال: income_threshold_citizen
            $table->text('value'); // القيمة (مثلاً: 4000)
            $table->text('description')->nullable(); // وصف للإعداد
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('settings');
    }
};
