<?php

namespace App\Http\Controllers\Api;

use App\Enums\ReconciliationStatus;
use App\Http\Controllers\Controller;
use App\Models\CashReconciliation;
use App\Models\Shift;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CashReconciliationController extends Controller
{
    /**
     * Cash difference (absolute, in rupiah) below which a reconciliation
     * is auto-approved without an explanation note (PRD §6.4).
     */
    private const int AUTO_APPROVE_TOLERANCE = 10_000;

    /**
     * List reconciliations, optionally filtered by outlet.
     */
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'outlet_id' => ['sometimes', 'integer', Rule::exists('outlets', 'id')],
        ]);

        $reconciliations = CashReconciliation::query()
            ->when($validated['outlet_id'] ?? null, fn ($query, $outletId) => $query->where('outlet_id', $outletId))
            ->latest('reconciled_at')
            ->paginate();

        return response()->json($reconciliations);
    }

    /**
     * Close the register for a shift: expected vs actual cash. A large
     * difference requires an explanation note on the spot (PRD §6.4).
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'shift_id' => ['required', 'integer', Rule::exists('shifts', 'id'), Rule::unique('cash_reconciliations', 'shift_id')],
            'actual_cash' => ['required', 'integer', 'min:0'],
            'note' => ['nullable', 'string', 'max:1000'],
        ]);

        $shift = Shift::query()->whereKey($validated['shift_id'])->firstOrFail();

        $expected = $shift->opening_cash + (int) $shift->transactions()->sum('total_amount');
        $difference = $validated['actual_cash'] - $expected;
        $withinTolerance = abs($difference) <= self::AUTO_APPROVE_TOLERANCE;

        if (! $withinTolerance && blank($validated['note'] ?? null)) {
            return response()->json([
                'message' => 'Selisih kas di luar toleransi — catatan alasan wajib diisi.',
                'errors' => ['note' => ['Catatan alasan wajib diisi untuk selisih besar.']],
            ], 422);
        }

        $reconciliation = CashReconciliation::create([
            'outlet_id' => $shift->outlet_id,
            'shift_id' => $shift->id,
            'expected_cash' => $expected,
            'actual_cash' => $validated['actual_cash'],
            'difference' => $difference,
            'status' => $withinTolerance ? ReconciliationStatus::AutoApproved : ReconciliationStatus::Explained,
            'note' => $validated['note'] ?? null,
            'created_by' => $request->user()->id,
            'reconciled_at' => now(),
        ]);

        return response()->json(['data' => $reconciliation], 201);
    }

    /**
     * Display the specified reconciliation.
     */
    public function show(CashReconciliation $cashReconciliation): JsonResponse
    {
        return response()->json(['data' => $cashReconciliation->load('shift')]);
    }
}
