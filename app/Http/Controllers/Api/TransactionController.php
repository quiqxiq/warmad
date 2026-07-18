<?php

namespace App\Http\Controllers\Api;

use App\Actions\Transactions\CreateTransactionBatchAction;
use App\Enums\InputMethod;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreTransactionBatchRequest;
use App\Models\Debt;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;
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
            'payment_amount' => ['nullable', 'integer', 'min:0'],
            'customer_name' => [
                'nullable',
                'string',
                'max:255',
                Rule::requiredIf(function () use ($request) {
                    $total = $request->integer('quantity', 0) * $request->integer('unit_price', 0);

                    return $request->has('payment_amount') && $request->integer('payment_amount') < $total;
                }),
            ],
            'input_method' => ['required', Rule::enum(InputMethod::class)],
            'note' => ['nullable', 'string', 'max:255'],
            'occurred_at' => ['required', 'date'],
        ]);

        $totalAmount = $validated['quantity'] * $validated['unit_price'];
        $paymentAmount = $validated['payment_amount'] ?? $totalAmount;
        $changeAmount = max(0, $paymentAmount - $totalAmount);

        $customerName = $validated['customer_name'] ?? null;
        unset($validated['customer_name']);

        $transaction = DB::transaction(function () use ($validated, $request, $totalAmount, $paymentAmount, $changeAmount, $customerName) {
            $tx = Transaction::updateOrCreate(
                ['client_uuid' => $validated['client_uuid']],
                [
                    ...$validated,
                    'user_id' => $request->user()->id,
                    'total_amount' => $totalAmount,
                    'payment_amount' => $paymentAmount,
                    'change_amount' => $changeAmount,
                ],
            );

            if ($tx->wasRecentlyCreated && $paymentAmount < $totalAmount) {
                Debt::create([
                    'client_uuid' => (string) Str::uuid(),
                    'tenant_id' => $tx->tenant_id,
                    'outlet_id' => $validated['outlet_id'],
                    'customer_name' => $customerName,
                    'amount' => $totalAmount - $paymentAmount,
                    'paid_amount' => 0,
                    'status' => 'unpaid',
                    'incurred_at' => Carbon::parse($validated['occurred_at'])->toDateString(),
                    'note' => 'Bon otomatis dari transaksi kasir. '.($validated['note'] ?? ''),
                    'created_by' => $request->user()->id,
                ]);
            }

            return $tx;
        });

        return response()->json(['data' => $transaction], $transaction->wasRecentlyCreated ? 201 : 200);
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
