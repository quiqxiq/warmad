<?php

namespace App\Http\Controllers\Api;

use App\Enums\ShiftStatus;
use App\Http\Controllers\Controller;
use App\Models\Shift;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class ShiftController extends Controller
{
    /**
     * List shifts, optionally filtered by outlet.
     */
    public function index(Request $request): JsonResponse
    {
        Gate::authorize('viewAny', Shift::class);

        $validated = $request->validate([
            'outlet_id' => ['sometimes', 'integer', Rule::exists('outlets', 'id')],
        ]);

        $shifts = Shift::query()
            ->when($validated['outlet_id'] ?? null, fn ($query, $outletId) => $query->where('outlet_id', $outletId))
            ->latest('started_at')
            ->paginate();

        return response()->json($shifts);
    }

    /**
     * Start a new shift. Idempotent on client_uuid for offline retry
     * safety (PRD §8.3).
     */
    public function store(Request $request): JsonResponse
    {
        Gate::authorize('create', Shift::class);

        $validated = $request->validate([
            'client_uuid' => ['required', 'uuid'],
            'outlet_id' => ['required', 'integer', Rule::exists('outlets', 'id')],
            'opening_cash' => ['required', 'integer', 'min:0'],
            'started_at' => ['required', 'date'],
        ]);

        $shift = Shift::updateOrCreate(
            ['client_uuid' => $validated['client_uuid']],
            [...$validated, 'user_id' => $request->user()->id, 'status' => ShiftStatus::Active],
        );

        return response()->json(['data' => $shift], $shift->wasRecentlyCreated ? 201 : 200);
    }

    /**
     * Display the specified shift.
     */
    public function show(Shift $shift): JsonResponse
    {
        Gate::authorize('view', $shift);

        return response()->json([
            'data' => $shift->load('cashReconciliation'),
        ]);
    }

    /**
     * Close the specified shift.
     */
    public function update(Request $request, Shift $shift): JsonResponse
    {
        Gate::authorize('update', $shift);

        $validated = $request->validate([
            'status' => ['required', Rule::enum(ShiftStatus::class)],
            'ended_at' => ['required_if:status,closed', 'nullable', 'date'],
        ]);

        $shift->update($validated);

        return response()->json(['data' => $shift]);
    }
}
