<?php

namespace App\Http\Controllers\Api;

use App\Enums\ShiftStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreShiftRequest;
use App\Models\Outlet;
use App\Models\Shift;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
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

        /** @var User $user */
        $user = $request->user();
        $accessibleOutletIds = Outlet::query()->accessibleTo($user)->pluck('id');
        $validated = $request->validate([
            'outlet_id' => ['sometimes', 'integer', Rule::in($accessibleOutletIds)],
        ]);

        $shifts = Shift::query()
            ->whereIn('outlet_id', $accessibleOutletIds)
            ->when($validated['outlet_id'] ?? null, fn ($query, $outletId) => $query->where('outlet_id', $outletId))
            ->latest('started_at')
            ->paginate();

        return response()->json($shifts);
    }

    /**
     * Start a new shift. Idempotent on client_uuid for offline retry
     * safety (PRD §8.3).
     */
    public function store(StoreShiftRequest $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $payload = $request->payload();
        $created = false;

        $shift = DB::transaction(function () use ($payload, $user, &$created): Shift {
            Tenant::query()
                ->whereKey($user->tenant_id)
                ->lockForUpdate()
                ->firstOrFail();

            $existingShift = Shift::query()
                ->where('tenant_id', $user->tenant_id)
                ->where('client_uuid', $payload['client_uuid'])
                ->first();

            if ($existingShift !== null) {
                return $existingShift;
            }

            $created = true;

            return Shift::create([
                ...$payload,
                'tenant_id' => $user->tenant_id,
                'user_id' => $user->id,
                'status' => ShiftStatus::Active,
            ]);
        }, attempts: 3);

        return response()->json(['data' => $shift], $created ? 201 : 200);
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
}
