<?php

namespace App\Http\Controllers;

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
            'outlet' => ['nullable', 'integer'],
        ]);

        /** @var User $user */
        $user = $request->user();
        $outlets = Outlet::query()
            ->accessibleTo($user)
            ->orderBy('name')
            ->get(['id', 'name', 'address', 'is_active']);

        $selectedOutlet = isset($validated['outlet'])
            ? $outlets->firstWhere('id', $validated['outlet'])
            : null;
        $selectedOutlet ??= $outlets->first();

        $debts = $selectedOutlet === null
            ? collect()
            : Debt::query()
                ->whereBelongsTo($selectedOutlet)
                ->latest('incurred_at')
                ->latest('id')
                ->limit(100)
                ->get();

        return Inertia::render('debts/index', [
            'outlets' => $outlets,
            'selectedOutlet' => $selectedOutlet,
            'debts' => $debts,
        ]);
    }
}
