<?php

use App\Http\Controllers\CashierController;
use App\Http\Controllers\DebtPageController;
use App\Http\Controllers\OutletController;
use Illuminate\Support\Facades\Route;

Route::inertia('/', 'welcome')->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::inertia('dashboard', 'dashboard')->name('dashboard');

    Route::get('outlets', [OutletController::class, 'index'])->name('outlets.index');
    Route::post('outlets', [OutletController::class, 'store'])->name('outlets.store');

    Route::get('cashier', [CashierController::class, 'index'])->name('cashier.index');
    Route::get('debts', [DebtPageController::class, 'index'])->name('debts.index');
});

require __DIR__.'/settings.php';
