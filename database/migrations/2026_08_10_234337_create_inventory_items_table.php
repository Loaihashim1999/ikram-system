<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('inventory_items', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name'); // اسم الصنف (مثال: سلة غذائية، تمر، أرز)
            $table->string('unit')->default('كرتون'); // وحدة القياس
            $table->integer('current_quantity')->default(0); // الكمية الحالية
            $table->integer('min_threshold')->default(10); // الحد الأدنى للتنبيه
            $table->text('description')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void {
        Schema::dropIfExists('inventory_items');
    }
};