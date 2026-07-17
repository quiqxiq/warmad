<?php

namespace App\Http\Controllers\Api;

use App\Enums\InputMethod;
use App\Http\Controllers\Controller;
use App\Models\Transaction;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class TransactionController extends Controller
{
    /**
     * List transactions, filterable by outlet and shift.
     */
    public function index(Request $request): JsonResponse
    {
        Gate::authorize('viewAny', Transaction::class);

        $validated = $request->validate([
            'outlet_id' => ['sometimes', 'integer', Rule::exists('outlets', 'id')],
            'shift_id' => ['sometimes', 'integer', Rule::exists('shifts', 'id')],
        ]);

        $transactions = Transaction::query()
            ->when($validated['outlet_id'] ?? null, fn ($query, $outletId) => $query->where('outlet_id', $outletId))
            ->when($validated['shift_id'] ?? null, fn ($query, $shiftId) => $query->where('shift_id', $shiftId))
            ->latest('occurred_at')
            ->paginate();

        return response()->json($transactions);
    }

    /**
     * Record a transaction. Idempotent on client_uuid so the PWA can
     * safely retry after a dropped connection (PRD §8.3).
     */
    public function store(Request $request): JsonResponse
    {
        Gate::authorize('create', Transaction::class);

        $validated = $request->validate([
            'client_uuid' => ['required', 'uuid'],
            'outlet_id' => ['required', 'integer', Rule::exists('outlets', 'id')],
            'shift_id' => ['required', 'integer', Rule::exists('shifts', 'id')],
            'category_id' => ['required', 'integer', Rule::exists('categories', 'id')],
            'barcode' => ['nullable', 'string', 'max:255'],
            'quantity' => ['required', 'integer', 'min:1'],
            'unit_price' => ['required', 'integer', 'min:0'],
            'input_method' => ['required', Rule::enum(InputMethod::class)],
            'note' => ['nullable', 'string', 'max:255'],
            'occurred_at' => ['required', 'date'],
        ]);

        $transaction = Transaction::updateOrCreate(
            ['client_uuid' => $validated['client_uuid']],
            [
                ...$validated,
                'user_id' => $request->user()->id,
                'total_amount' => $validated['quantity'] * $validated['unit_price'],
            ],
        );

        return response()->json(['data' => $transaction], $transaction->wasRecentlyCreated ? 201 : 200);
    }

    /**
     * Display the specified transaction.
     */
    public function show(Transaction $transaction): JsonResponse
    {
        Gate::authorize('view', $transaction);

        return response()->json(['data' => $transaction->load('category')]);
    }
}
