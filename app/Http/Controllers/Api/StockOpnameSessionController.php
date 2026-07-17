<?php

namespace App\Http\Controllers\Api;

use App\Enums\OpnameSessionStatus;
use App\Enums\OpnameSessionType;
use App\Http\Controllers\Controller;
use App\Models\StockOpnameSession;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class StockOpnameSessionController extends Controller
{
    /**
     * List opname sessions, optionally filtered by outlet.
     */
    public function index(Request $request): JsonResponse
    {
        Gate::authorize('viewAny', StockOpnameSession::class);

        $validated = $request->validate([
            'outlet_id' => ['sometimes', 'integer', Rule::exists('outlets', 'id')],
        ]);

        $sessions = StockOpnameSession::query()
            ->when($validated['outlet_id'] ?? null, fn ($query, $outletId) => $query->where('outlet_id', $outletId))
            ->latest()
            ->paginate();

        return response()->json($sessions);
    }

    /**
     * Open a new opname session (initial stock take or handover).
     */
    public function store(Request $request): JsonResponse
    {
        Gate::authorize('create', StockOpnameSession::class);

        $validated = $request->validate([
            'outlet_id' => ['required', 'integer', Rule::exists('outlets', 'id')],
            'type' => ['required', Rule::enum(OpnameSessionType::class)],
            'outgoing_user_id' => ['required_if:type,handover', 'nullable', 'integer', Rule::exists('users', 'id')],
            'incoming_user_id' => ['required', 'integer', Rule::exists('users', 'id')],
            'note' => ['nullable', 'string', 'max:1000'],
        ]);

        $session = StockOpnameSession::create([
            ...$validated,
            'status' => OpnameSessionStatus::Draft,
            'created_by' => $request->user()->id,
        ]);

        return response()->json(['data' => $session], 201);
    }

    /**
     * Display the specified session with its items.
     */
    public function show(StockOpnameSession $stockOpnameSession): JsonResponse
    {
        Gate::authorize('view', $stockOpnameSession);

        return response()->json([
            'data' => $stockOpnameSession->load('items', 'outgoingUser', 'incomingUser'),
        ]);
    }

    /**
     * Update session status or notes. Finalization goes through confirm().
     */
    public function update(Request $request, StockOpnameSession $stockOpnameSession): JsonResponse
    {
        Gate::authorize('update', $stockOpnameSession);

        $validated = $request->validate([
            'status' => ['sometimes', Rule::enum(OpnameSessionStatus::class), Rule::notIn([OpnameSessionStatus::Final->value])],
            'note' => ['nullable', 'string', 'max:1000'],
        ]);

        $stockOpnameSession->update([...$validated, 'updated_by' => $request->user()->id]);

        return response()->json(['data' => $stockOpnameSession]);
    }

    /**
     * Record the caller's confirmation. The session only becomes final
     * once BOTH parties have confirmed (PRD §6.2 acceptance criteria).
     */
    public function confirm(Request $request, StockOpnameSession $stockOpnameSession): JsonResponse
    {
        Gate::authorize('update', $stockOpnameSession);

        $user = $request->user();

        if (! in_array($user->id, [$stockOpnameSession->outgoing_user_id, $stockOpnameSession->incoming_user_id], true)) {
            abort(403, 'Hanya pihak yang terlibat sesi yang bisa konfirmasi.');
        }

        abort_if(
            $stockOpnameSession->status === OpnameSessionStatus::Final,
            422,
            'Sesi sudah final dan terkunci.',
        );

        if ($user->id === $stockOpnameSession->outgoing_user_id) {
            $stockOpnameSession->update(['outgoing_confirmed_at' => now()]);
        }

        if ($user->id === $stockOpnameSession->incoming_user_id) {
            $stockOpnameSession->update(['incoming_confirmed_at' => now()]);
        }

        $requiresBothParties = $stockOpnameSession->type === OpnameSessionType::Handover;
        $isConfirmed = $requiresBothParties
            ? $stockOpnameSession->isFullyConfirmed()
            : $stockOpnameSession->incoming_confirmed_at !== null;

        if ($isConfirmed) {
            $stockOpnameSession->update([
                'status' => OpnameSessionStatus::Final,
                'total_value' => (int) $stockOpnameSession->items()
                    ->selectRaw('COALESCE(SUM(quantity * unit_price), 0) as total')
                    ->value('total'),
                'finalized_at' => now(),
                'updated_by' => $user->id,
            ]);
        }

        return response()->json(['data' => $stockOpnameSession->refresh()]);
    }
}
