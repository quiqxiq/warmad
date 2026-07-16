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
        Schema::create('stock_opname_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('outlet_id')->constrained()->cascadeOnDelete();
            $table->string('type');
            $table->string('status')->default('draft');
            $table->foreignId('outgoing_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('incoming_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('outgoing_confirmed_at')->nullable();
            $table->timestamp('incoming_confirmed_at')->nullable();
            $table->unsignedBigInteger('total_value')->nullable();
            $table->timestamp('finalized_at')->nullable();
            $table->text('note')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['outlet_id', 'status']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('stock_opname_sessions');
    }
};
