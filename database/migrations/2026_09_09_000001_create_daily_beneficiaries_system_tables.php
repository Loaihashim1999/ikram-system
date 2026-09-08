<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. المستفيدون اليوميون
        Schema::create('daily_beneficiaries', function (Blueprint $table) {
            $idCol = $table->uuid('id')->primary();
            if (Schema::getConnection()->getDriverName() === 'pgsql') {
                $idCol->default(DB::raw('gen_random_uuid()'));
            }

            $table->string('full_name', 150);
            $table->string('national_id', 20)->unique()->index();
            $table->string('phone', 20)->index();
            $table->date('date_of_birth')->nullable();
            $table->string('district', 100)->index(); // الحي
            $table->uuid('category_id')->nullable();
            $table->string('category_name', 100)->nullable();
            $table->string('status', 20)->default('active')->index(); // active, inactive
            $table->integer('total_received_count')->default(0);
            $table->timestamp('last_delivery_date')->nullable();
            $table->text('notes')->nullable();
            $table->uuid('created_by')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('category_id')->references('id')->on('categories')->nullOnDelete();
            $table->foreign('created_by')->references('id')->on('users')->nullOnDelete();
        });

        // 2. وثائق المستفيدين اليوميين
        Schema::create('daily_beneficiary_documents', function (Blueprint $table) {
            $idCol = $table->uuid('id')->primary();
            if (Schema::getConnection()->getDriverName() === 'pgsql') {
                $idCol->default(DB::raw('gen_random_uuid()'));
            }

            $table->uuid('daily_beneficiary_id');
            $table->string('document_type', 50); // national_id, residence_id, medical_report, other
            $table->string('file_name', 255);
            $table->string('file_path', 255);
            $table->text('file_url')->nullable();
            $table->string('file_type', 50)->nullable();
            $table->integer('file_size')->nullable();
            $table->uuid('uploaded_by')->nullable();
            $table->timestamps();

            $table->foreign('daily_beneficiary_id')->references('id')->on('daily_beneficiaries')->cascadeOnDelete();
            $table->foreign('uploaded_by')->references('id')->on('users')->nullOnDelete();
        });

        // 3. مستودع المستفيدين اليوميين
        Schema::create('daily_inventory_items', function (Blueprint $table) {
            $idCol = $table->uuid('id')->primary();
            if (Schema::getConnection()->getDriverName() === 'pgsql') {
                $idCol->default(DB::raw('gen_random_uuid()'));
            }

            $table->string('name', 150);
            $table->string('unit', 50)->default('سلة');
            $table->integer('current_quantity')->default(0);
            $table->integer('reserved_quantity')->default(0);
            $table->integer('min_threshold')->default(5);
            $table->string('category', 100)->nullable();
            $table->string('batch_number', 100)->nullable();
            $table->string('supplier', 150)->nullable();
            $table->date('expiry_date')->nullable()->index();
            $table->text('description')->nullable();
            $table->string('status', 30)->default('available')->index();
            $table->timestamps();
            $table->softDeletes();
        });

        // 4. حركات مستودع المستفيدين اليوميين
        Schema::create('daily_inventory_movements', function (Blueprint $table) {
            $idCol = $table->uuid('id')->primary();
            if (Schema::getConnection()->getDriverName() === 'pgsql') {
                $idCol->default(DB::raw('gen_random_uuid()'));
            }

            $table->uuid('daily_inventory_item_id');
            $table->string('type', 20); // in, out, adjustment
            $table->integer('quantity');
            $table->string('reason', 255);
            $table->text('notes')->nullable();
            $table->uuid('user_id')->nullable();
            $table->uuid('related_receiving_id')->nullable();
            $table->timestamps();

            $table->foreign('daily_inventory_item_id')->references('id')->on('daily_inventory_items')->cascadeOnDelete();
            $table->foreign('user_id')->references('id')->on('users')->nullOnDelete();
        });

        // 5. عمليات استلام ومساعدات المستفيدين اليوميين
        Schema::create('daily_receiving_transactions', function (Blueprint $table) {
            $idCol = $table->uuid('id')->primary();
            if (Schema::getConnection()->getDriverName() === 'pgsql') {
                $idCol->default(DB::raw('gen_random_uuid()'));
            }

            $table->string('document_number', 50)->unique()->index();
            $table->uuid('daily_beneficiary_id');
            $table->uuid('daily_inventory_item_id');
            $table->string('basket_type_name', 150);
            $table->integer('quantity')->default(1);
            $table->string('status', 30)->default('received')->index(); // received, cancelled
            $table->timestamp('receiving_date')->index();
            $table->uuid('authorized_user_id')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->foreign('daily_beneficiary_id')->references('id')->on('daily_beneficiaries')->restrictOnDelete();
            $table->foreign('daily_inventory_item_id')->references('id')->on('daily_inventory_items')->restrictOnDelete();
            $table->foreign('authorized_user_id')->references('id')->on('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('daily_receiving_transactions');
        Schema::dropIfExists('daily_inventory_movements');
        Schema::dropIfExists('daily_inventory_items');
        Schema::dropIfExists('daily_beneficiary_documents');
        Schema::dropIfExists('daily_beneficiaries');
    }
};
