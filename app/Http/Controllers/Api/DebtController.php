<?php

namespace App\Http\Controllers\Api;

use App\Enums\DebtStatus;
use App\Http\Controllers\Controller;
use App\Models\Debt;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class DebtController extends Controller
{
    /**
     * List customer debts, filterable by outlet and status.
     */
    public function index(Request $request): JsonResponse
    {
        Gate::authorize('viewAny', Debt::class);

        $validated = $request->validate([
            'outlet_id' => ['sometimes', 'integer', Rule::exists('outlets', 'id')],
            'status' => ['sometimes', Rule::enum(DebtStatus::class)],
        ]);

        $debts = Debt::query()
            ->when($validated['outlet_id'] ?? null, fn ($query, $outletId) => $query->where('outlet_id', $outletId))
            ->when($validated['status'] ?? null, fn ($query, $status) => $query->where('status', $status))
            ->latest('incurred_at')
            ->paginate();

        return response()->json($debts);
    }

    /**
     * Record a customer debt. Idempotent on client_uuid.
     */
    public function store(Request $request): JsonResponse
    {
        Gate::authorize('create', Debt::class);

        $validated = $request->validate([
            'client_uuid' => ['required', 'uuid'],
            'outlet_id' => ['required', 'integer', Rule::exists('outlets', 'id')],
            'customer_name' => ['required', 'string', 'max:255'],
            'amount' => ['required', 'integer', 'min:1'],
            'incurred_at' => ['required', 'date'],
            'note' => ['nullable', 'string', 'max:255'],
        ]);

        $debt = Debt::updateOrCreate(
            ['client_uuid' => $validated['client_uuid']],
            [...$validated, 'created_by' => $request->user()->id],
        );

        return response()->json(['data' => $debt], $debt->wasRecentlyCreated ? 201 : 200);
    }

    /**
     * Display the specified debt.
     */
    public function show(Debt $debt): JsonResponse
    {
        Gate::authorize('view', $debt);

        return response()->json(['data' => $debt]);
    }
}
