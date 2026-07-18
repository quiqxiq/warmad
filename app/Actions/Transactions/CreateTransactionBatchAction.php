<?php

namespace App\Actions\Transactions;

use App\Enums\DebtStatus;
use App\Enums\ShiftStatus;
use App\Models\Category;
use App\Models\Debt;
use App\Models\Outlet;
use App\Models\Shift;
use App\Models\Tenant;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use LogicException;
use Ramsey\Uuid\Uuid;

class CreateTransactionBatchAction
{
    /**
     * Store an idempotent multi-item sale.
     *
     * @param  array{
     *     client_uuid: string,
     *     outlet_id: int,
     *     shift_id: int,
     *     items: list<array{category_id: int, quantity: int, unit_price: int}>,
     *     payment_amount?: int|null,
     *     customer_name?: string|null,
     *     input_method: string,
     *     note?: string|null,
     *     occurred_at: string
     * }  $data
     * @return array{
     *     created: bool,
     *     data: array{
     *         sale_uuid: string,
     *         items: Collection<int, Transaction>,
     *         total_amount: int,
     *         payment_amount: int,
     *         change_amount: int,
     *         debt_amount: int
     *     }
     * }
     */
    public function handle(array $data, User $user): array
    {
        $tenantId = $user->tenant_id;

        if ($tenantId === null) {
            throw new LogicException('A tenant is required to create a transaction batch.');
        }

        return DB::transaction(function () use ($data, $user, $tenantId): array {
            Tenant::query()
                ->whereKey($tenantId)
                ->lockForUpdate()
                ->firstOrFail();

            $transactions = Transaction::query()
                ->where('tenant_id', $tenantId)
                ->where('sale_uuid', $data['client_uuid'])
                ->oldest('id')
                ->get();

            if ($transactions->isNotEmpty()) {
                return [
                    'created' => false,
                    'data' => $this->responseData($data['client_uuid'], $transactions),
                ];
            }

            $outlet = Outlet::query()
                ->accessibleTo($user)
                ->whereKey($data['outlet_id'])
                ->where('tenant_id', $tenantId)
                ->where('is_active', true)
                ->first();

            if ($outlet === null) {
                throw ValidationException::withMessages([
                    'outlet_id' => ['The selected outlet is invalid.'],
                ]);
            }

            $shiftExists = Shift::query()
                ->whereKey($data['shift_id'])
                ->where('tenant_id', $tenantId)
                ->whereBelongsTo($outlet)
                ->whereBelongsTo($user)
                ->where('status', ShiftStatus::Active)
                ->exists();

            if (! $shiftExists) {
                throw ValidationException::withMessages([
                    'shift_id' => ['The selected shift is no longer active.'],
                ]);
            }

            $categoryIds = collect($data['items'])->pluck('category_id')->unique();
            $validCategoryCount = Category::query()
                ->where('tenant_id', $tenantId)
                ->whereBelongsTo($outlet)
                ->where('is_active', true)
                ->whereIn('id', $categoryIds)
                ->count();

            if ($validCategoryCount !== $categoryIds->count()) {
                throw ValidationException::withMessages([
                    'items' => ['One or more categories are no longer available.'],
                ]);
            }

            $totalAmount = 0;

            foreach ($data['items'] as $item) {
                $totalAmount += $item['quantity'] * $item['unit_price'];
            }

            $paymentAmount = $data['payment_amount'] ?? $totalAmount;
            $retainedPayment = min($paymentAmount, $totalAmount);
            $changeAmount = max($paymentAmount - $totalAmount, 0);
            $remainingPayment = $retainedPayment;
            $lastItemIndex = count($data['items']) - 1;

            foreach ($data['items'] as $index => $item) {
                $itemTotal = $item['quantity'] * $item['unit_price'];
                $itemPayment = min($remainingPayment, $itemTotal);
                $remainingPayment -= $itemPayment;

                $transactions->push(Transaction::create([
                    'client_uuid' => $this->lineUuid($tenantId, $data['client_uuid'], $index),
                    'sale_uuid' => $data['client_uuid'],
                    'tenant_id' => $tenantId,
                    'outlet_id' => $data['outlet_id'],
                    'shift_id' => $data['shift_id'],
                    'category_id' => $item['category_id'],
                    'user_id' => $user->id,
                    'quantity' => $item['quantity'],
                    'unit_price' => $item['unit_price'],
                    'total_amount' => $itemTotal,
                    'payment_amount' => $itemPayment,
                    'change_amount' => $index === $lastItemIndex ? $changeAmount : 0,
                    'input_method' => $data['input_method'],
                    'note' => $data['note'] ?? null,
                    'occurred_at' => $data['occurred_at'],
                ]));
            }

            $debtAmount = $totalAmount - $retainedPayment;

            if ($debtAmount > 0) {
                $customerName = $data['customer_name'] ?? null;

                if (! is_string($customerName) || blank($customerName)) {
                    throw new LogicException('A customer name is required when the sale creates a debt.');
                }

                $debtNote = 'Bon otomatis dari transaksi kasir.';

                if (filled($data['note'] ?? null)) {
                    $debtNote .= ' '.$data['note'];
                }

                Debt::create([
                    'client_uuid' => $this->debtUuid($tenantId, $data['client_uuid']),
                    'tenant_id' => $tenantId,
                    'outlet_id' => $data['outlet_id'],
                    'customer_name' => $customerName,
                    'amount' => $debtAmount,
                    'paid_amount' => 0,
                    'status' => DebtStatus::Unpaid,
                    'incurred_at' => Carbon::parse($data['occurred_at'])->toDateString(),
                    'note' => Str::limit($debtNote, 255, ''),
                    'created_by' => $user->id,
                ]);
            }

            return [
                'created' => true,
                'data' => $this->responseData($data['client_uuid'], $transactions),
            ];
        }, attempts: 3);
    }

    /**
     * @param  Collection<int, Transaction>  $transactions
     * @return array{
     *     sale_uuid: string,
     *     items: Collection<int, Transaction>,
     *     total_amount: int,
     *     payment_amount: int,
     *     change_amount: int,
     *     debt_amount: int
     * }
     */
    private function responseData(string $saleUuid, Collection $transactions): array
    {
        $totalAmount = (int) $transactions->sum('total_amount');
        $retainedPayment = (int) $transactions->sum('payment_amount');
        $changeAmount = (int) $transactions->sum('change_amount');

        return [
            'sale_uuid' => $saleUuid,
            'items' => $transactions->values(),
            'total_amount' => $totalAmount,
            'payment_amount' => $retainedPayment + $changeAmount,
            'change_amount' => $changeAmount,
            'debt_amount' => max($totalAmount - $retainedPayment, 0),
        ];
    }

    private function lineUuid(int $tenantId, string $saleUuid, int $index): string
    {
        return Uuid::uuid5(Uuid::NAMESPACE_URL, "amanah:transaction:{$tenantId}:{$saleUuid}:{$index}")->toString();
    }

    private function debtUuid(int $tenantId, string $saleUuid): string
    {
        return Uuid::uuid5(Uuid::NAMESPACE_URL, "amanah:debt:{$tenantId}:{$saleUuid}")->toString();
    }
}
