<?php

use App\Http\Controllers\Api\Auth\OtpController;
use App\Http\Controllers\Api\Auth\RegisterController;
use App\Http\Controllers\Api\CashReconciliationController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\DebtController;
use App\Http\Controllers\Api\DebtPaymentController;
use App\Http\Controllers\Api\OutletController;
use App\Http\Controllers\Api\ShiftController;
use App\Http\Controllers\Api\StockOpnameItemController;
use App\Http\Controllers\Api\StockOpnameSessionController;
use App\Http\Controllers\Api\TransactionController;
use App\Http\Controllers\Api\VoiceParserController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::post('auth/otp/request', [OtpController::class, 'request'])->name('api.auth.otp.request');
Route::post('auth/otp/verify', [OtpController::class, 'verify'])
    ->middleware('throttle:10,1')
    ->name('api.auth.otp.verify');

Route::post('auth/register/request-otp', [RegisterController::class, 'requestOtp'])
    ->middleware('throttle:10,1')
    ->name('api.auth.register.request-otp');
Route::post('auth/register/verify', [RegisterController::class, 'verify'])
    ->middleware('throttle:10,1')
    ->name('api.auth.register.verify');

Route::middleware('auth:sanctum')->group(function () {
    Route::get('user', function (Request $request) {
        return $request->user();
    })->name('api.user');

    Route::apiResource('outlets', OutletController::class);
    Route::apiResource('categories', CategoryController::class);
    Route::apiResource('shifts', ShiftController::class)->only(['index', 'store', 'show']);
    Route::post('transactions/batch', [TransactionController::class, 'storeBatch'])
        ->name('api.transactions.batch-store');
    Route::apiResource('transactions', TransactionController::class)->only(['index', 'show']);
    Route::apiResource('cash-reconciliations', CashReconciliationController::class)->only(['index', 'store', 'show']);
    Route::apiResource('debts', DebtController::class)
        ->only(['index', 'store', 'show'])
        ->names([
            'index' => 'api.debts.index',
            'store' => 'api.debts.store',
            'show' => 'api.debts.show',
        ]);
    Route::post('debts/{debt}/payments', [DebtPaymentController::class, 'store'])
        ->name('api.debts.payments.store');

    Route::apiResource('stock-opname-sessions', StockOpnameSessionController::class)->except('destroy');
    Route::post('stock-opname-sessions/{stock_opname_session}/confirm', [StockOpnameSessionController::class, 'confirm'])
        ->name('stock-opname-sessions.confirm');

    Route::get('stock-opname-sessions/{stock_opname_session}/items', [StockOpnameItemController::class, 'index'])
        ->name('stock-opname-sessions.items.index');
    Route::post('stock-opname-sessions/{stock_opname_session}/items', [StockOpnameItemController::class, 'store'])
        ->name('stock-opname-sessions.items.store');
    Route::delete('stock-opname-sessions/{stock_opname_session}/items/{item}', [StockOpnameItemController::class, 'destroy'])
        ->name('stock-opname-sessions.items.destroy');

    Route::post('voice/parse', [VoiceParserController::class, 'parse'])
        ->middleware('throttle:voice-parse')
        ->name('api.voice.parse');
});
