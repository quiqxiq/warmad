<?php

namespace App\Http\Controllers\Api;

use App\Actions\Reconciliations\CreateCashReconciliationAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreCashReconciliationRequest;
use App\Models\CashReconciliation;
use App\Models\Outlet;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class CashReconciliationController extends Controller
{
    /**
     * List reconciliations, optionally filtered by outlet.
     */
    public function index(Request $request): JsonResponse
    {
        Gate::authorize('viewAny', CashReconciliation::class);

        /** @var User $user */
        $user = $request->user();
        $accessibleOutletIds = Outlet::query()->accessibleTo($user)->pluck('id');
        $validated = $request->validate([
            'outlet_id' => ['sometimes', 'integer', Rule::in($accessibleOutletIds)],
        ]);

        $reconciliations = CashReconciliation::query()
            ->whereIn('outlet_id', $accessibleOutletIds)
            ->when($validated['outlet_id'] ?? null, fn ($query, $outletId) => $query->where('outlet_id', $outletId))
            ->latest('reconciled_at')
            ->paginate();

        return response()->json($reconciliations);
    }

    /**
     * Close the register for a shift: expected vs actual cash. A large
     * difference requires an explanation note on the spot (PRD §6.4).
     */
    public function store(
        StoreCashReconciliationRequest $request,
        CreateCashReconciliationAction $createCashReconciliation,
    ): JsonResponse {
        /** @var User $user */
        $user = $request->user();
        $result = $createCashReconciliation->handle($request->payload(), $user);

        return response()->json(
            ['data' => $result['reconciliation']],
            $result['created'] ? 201 : 200,
        );
    }

    /**
     * Display the specified reconciliation.
     */
    public function show(CashReconciliation $cashReconciliation): JsonResponse
    {
        Gate::authorize('view', $cashReconciliation);

        return response()->json(['data' => $cashReconciliation->load('shift')]);
    }
}
