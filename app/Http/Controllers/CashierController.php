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
        $stats = [
            'total_sales' => 0,
            'transaction_count' => 0,
            'outstanding_debt_amount' => 0,
            'outstanding_debt_count' => 0,
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

            $todaySalesStats = Transaction::query()
                ->whereBelongsTo($selectedOutlet)
                ->whereDate('occurred_at', today())
                ->toBase()
                ->selectRaw('COALESCE(SUM(total_amount), 0) as total_sales')
                ->selectRaw('COUNT(DISTINCT sale_uuid) as batched_sale_count')
                ->selectRaw('SUM(CASE WHEN sale_uuid IS NULL THEN 1 ELSE 0 END) as legacy_sale_count')
                ->first();

            $outstandingDebtStats = Debt::query()
                ->whereBelongsTo($selectedOutlet)
                ->whereIn('status', [DebtStatus::Unpaid->value, DebtStatus::PartiallyPaid->value])
                ->toBase()
                ->selectRaw('COALESCE(SUM(amount - paid_amount), 0) as outstanding_total')
                ->selectRaw('COUNT(*) as outstanding_count')
                ->first();

            $stats = [
                'total_sales' => (int) $todaySalesStats->total_sales,
                'transaction_count' => (int) $todaySalesStats->batched_sale_count + (int) $todaySalesStats->legacy_sale_count,
                'outstanding_debt_amount' => (int) $outstandingDebtStats->outstanding_total,
                'outstanding_debt_count' => (int) $outstandingDebtStats->outstanding_count,
            ];
        }

        return Inertia::render('cashier/index', [
            'outlets' => $outlets,
            'selectedOutlet' => $selectedOutlet,
            'activeShift' => $activeShift,
            'categories' => $categories,
            'stats' => $stats,
        ]);
    }
}
