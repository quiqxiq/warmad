<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('stock_opname_items', function (Blueprint $table) {
            $table->id();
            $table->uuid('client_uuid')->nullable()->unique();
            $table->foreignId('stock_opname_session_id')->constrained()->cascadeOnDelete();
            $table->string('section');
            $table->string('name');
            $table->string('barcode')->nullable();
            $table->decimal('quantity', 10, 2);
            $table->unsignedBigInteger('unit_price')->default(0);
            $table->string('input_method')->default('manual');
            $table->string('photo_before_path')->nullable();
            $table->string('photo_after_path')->nullable();
            $table->text('dispute_note')->nullable();
            $table->foreignId('counted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['stock_opname_session_id', 'section']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('stock_opname_items');
    }
};
