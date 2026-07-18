<?php

namespace App\Http\Controllers\Api;

use App\Actions\Transactions\CreateTransactionBatchAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreTransactionBatchRequest;
use App\Models\Transaction;
use App\Models\User;
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
     * Record an idempotent multi-item transaction batch.
     */
    public function storeBatch(
        StoreTransactionBatchRequest $request,
        CreateTransactionBatchAction $createTransactionBatch,
    ): JsonResponse {
        /** @var User $user */
        $user = $request->user();
        $result = $createTransactionBatch->handle($request->payload(), $user);

        return response()->json(
            ['data' => $result['data']],
            $result['created'] ? 201 : 200,
        );
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
