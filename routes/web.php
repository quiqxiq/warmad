<?php

use App\Http\Controllers\CashierController;
use App\Http\Controllers\DebtPageController;
use App\Http\Controllers\OutletController;
use App\Http\Controllers\PenjagaController;
use Illuminate\Support\Facades\Route;

Route::inertia('/', 'welcome')->name('home');

// Owner self-signup (phone + OTP). Registration is handled by the JSON API;
// this only serves the Inertia page. Penjaga are created from inside the app.
Route::inertia('register', 'auth/register')->name('register')->middleware('guest');

Route::middleware(['auth', 'phone.verified'])->group(function () {
    Route::inertia('dashboard', 'dashboard')->name('dashboard');

    Route::get('outlets', [OutletController::class, 'index'])->name('outlets.index');
    Route::post('outlets', [OutletController::class, 'store'])->name('outlets.store');

    Route::get('cashier', [CashierController::class, 'index'])->name('cashier.index');
    Route::get('debts', [DebtPageController::class, 'index'])->name('debts.index');

    Route::get('penjaga', [PenjagaController::class, 'index'])->name('penjaga.index');
    Route::post('penjaga', [PenjagaController::class, 'store'])->name('penjaga.store');
    Route::delete('penjaga/{penjaga}', [PenjagaController::class, 'destroy'])->name('penjaga.destroy');
});

require __DIR__.'/settings.php';
