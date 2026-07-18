<?php

namespace App\Http\Controllers;

use App\Enums\DebtStatus;
use App\Enums\ShiftStatus;
use App\Models\Category;
use App\Models\Debt;
use App\Models\Outlet;
use App\Models\Shift;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class CashierController extends Controller
{
    /**
     * Display the cashier workspace for an accessible outlet.
     */
    public function index(Request $request): Response
    {
        $validated = $request->validate([
            'outlet_id' => ['nullable', 'integer'],
        ]);

        /** @var User $user */
        $user = $request->user();
        $outlets = Outlet::query()
            ->accessibleTo($user)
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'address', 'is_active']);

        $selectedOutlet = isset($validated['outlet_id'])
            ? $outlets->firstWhere('id', $validated['outlet_id'])
            : null;
        $selectedOutlet ??= $outlets->first();

        $activeShift = null;
        $categories = collect();
        $todayStats = [
            'sales_total' => 0,
            'transactions_count' => 0,
            'unpaid_debt_total' => 0,
            'unpaid_debt_count' => 0,
        ];

        if ($selectedOutlet !== null) {
            $activeShift = Shift::query()
                ->whereBelongsTo($selectedOutlet)
                ->whereBelongsTo($user)
                ->where('status', ShiftStatus::Active)
                ->latest('started_at')
                ->first();

            $categories = Category::query()
                ->whereBelongsTo($selectedOutlet)
                ->where('is_active', true)
                ->orderBy('position')
                ->orderBy('name')
                ->get();

            $todaySales = Transaction::query()
                ->whereBelongsTo($selectedOutlet)
                ->whereDate('occurred_at', today());

            $outstandingDebtStats = Debt::query()
                ->whereBelongsTo($selectedOutlet)
                ->whereIn('status', [DebtStatus::Unpaid->value, DebtStatus::PartiallyPaid->value])
                ->toBase()
                ->selectRaw('COALESCE(SUM(amount - paid_amount), 0) as outstanding_total')
                ->selectRaw('COUNT(*) as outstanding_count')
                ->first();

            $todayStats = [
                'sales_total' => (int) (clone $todaySales)->sum('total_amount'),
                'transactions_count' => (clone $todaySales)->count(),
                'unpaid_debt_total' => (int) $outstandingDebtStats->outstanding_total,
                'unpaid_debt_count' => (int) $outstandingDebtStats->outstanding_count,
            ];
        }

        return Inertia::render('cashier/index', [
            'outlets' => $outlets,
            'selectedOutlet' => $selectedOutlet,
            'activeShift' => $activeShift,
            'categories' => $categories,
            'todayStats' => $todayStats,
        ]);
    }
}
