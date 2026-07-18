<?php

namespace App\Http\Controllers;

use App\Enums\DebtStatus;
use App\Models\Debt;
use App\Models\Outlet;
use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DebtPageController extends Controller
{
    /**
     * Display the latest debts for an accessible outlet.
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
            ->orderBy('name')
            ->get(['id', 'name', 'address', 'is_active']);

        $selectedOutlet = isset($validated['outlet_id'])
            ? $outlets->firstWhere('id', $validated['outlet_id'])
            : null;

        $debtsQuery = Debt::query()
            ->whereIn('outlet_id', $outlets->modelKeys())
            ->when(
                $selectedOutlet !== null,
                fn ($query) => $query->whereBelongsTo($selectedOutlet),
            );

        $summary = (clone $debtsQuery)
            ->toBase()
            ->selectRaw(
                'COALESCE(SUM(CASE WHEN status IN (?, ?) THEN amount - paid_amount ELSE 0 END), 0) as outstanding_amount',
                [DebtStatus::Unpaid->value, DebtStatus::PartiallyPaid->value],
            )
            ->selectRaw(
                'SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as unpaid_count',
                [DebtStatus::Unpaid->value],
            )
            ->selectRaw(
                'SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as paid_count',
                [DebtStatus::Paid->value],
            )
            ->first();

        $debts = $debtsQuery
            ->with('outlet:id,name')
            ->latest('incurred_at')
            ->latest('id')
            ->limit(100)
            ->get();

        return Inertia::render('debts/index', [
            'outlets' => $outlets,
            'selectedOutlet' => $selectedOutlet,
            'debts' => $debts,
            'summary' => [
                'outstanding_amount' => (int) $summary->outstanding_amount,
                'unpaid_count' => (int) $summary->unpaid_count,
                'paid_count' => (int) $summary->paid_count,
            ],
        ]);
    }
}
