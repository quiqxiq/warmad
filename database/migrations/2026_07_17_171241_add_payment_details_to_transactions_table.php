<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            $table->unsignedBigInteger('payment_amount')->nullable()->after('total_amount');
            $table->unsignedBigInteger('change_amount')->default(0)->after('payment_amount');
        });

        // Set default value for existing rows
        DB::statement('UPDATE transactions SET payment_amount = total_amount');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            $table->dropColumn(['payment_amount', 'change_amount']);
        });
    }
};
