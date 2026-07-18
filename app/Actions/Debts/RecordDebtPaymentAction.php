<?php

namespace App\Actions\Debts;

use App\Enums\DebtStatus;
use App\Enums\ShiftStatus;
use App\Models\Debt;
use App\Models\DebtPayment;
use App\Models\Shift;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use LogicException;

class RecordDebtPaymentAction
{
    /**
     * @param  array{client_uuid: string, shift_id: int, amount: int, paid_at: string}  $data
     * @return array{created: bool, payment: DebtPayment, debt: Debt}
     */
    public function handle(Debt $debt, array $data, User $user): array
    {
        $tenantId = $user->tenant_id;

        if ($tenantId === null) {
            throw new LogicException('A tenant is required to record a debt payment.');
        }

        return DB::transaction(function () use ($debt, $data, $user, $tenantId): array {
            Tenant::query()
                ->whereKey($tenantId)
                ->lockForUpdate()
                ->firstOrFail();

            $existingPayment = DebtPayment::query()
                ->where('tenant_id', $tenantId)
                ->where('client_uuid', $data['client_uuid'])
                ->first();

            if ($existingPayment !== null) {
                if (
                    $existingPayment->debt_id !== $debt->id
                    || $existingPayment->shift_id !== $data['shift_id']
                    || $existingPayment->amount !== $data['amount']
                    || ! $existingPayment->paid_at->equalTo($data['paid_at'])
                ) {
                    throw ValidationException::withMessages([
                        'client_uuid' => ['This idempotency key was already used for another payment.'],
                    ]);
                }

                return [
                    'created' => false,
                    'payment' => $existingPayment,
                    'debt' => $debt->refresh(),
                ];
            }

            $shift = Shift::query()
                ->whereKey($data['shift_id'])
                ->where('tenant_id', $tenantId)
                ->where('outlet_id', $debt->outlet_id)
                ->whereBelongsTo($user)
                ->lockForUpdate()
                ->first();

            if (
                $shift === null
                || $shift->status !== ShiftStatus::Active
                || $shift->cashReconciliation()->exists()
                || $shift->started_at->isAfter($data['paid_at'])
            ) {
                throw ValidationException::withMessages([
                    'shift_id' => ['The selected shift cannot receive this payment.'],
                ]);
            }

            $lockedDebt = Debt::query()
                ->whereKey($debt->id)
                ->where('tenant_id', $tenantId)
                ->where('outlet_id', $shift->outlet_id)
                ->lockForUpdate()
                ->firstOrFail();
            $remainingAmount = $lockedDebt->amount - $lockedDebt->paid_amount;

            if ($data['amount'] > $remainingAmount) {
                throw ValidationException::withMessages([
                    'amount' => ['The payment exceeds the remaining debt amount.'],
                ]);
            }

            $payment = DebtPayment::create([
                'client_uuid' => $data['client_uuid'],
                'tenant_id' => $tenantId,
                'outlet_id' => $lockedDebt->outlet_id,
                'debt_id' => $lockedDebt->id,
                'shift_id' => $shift->id,
                'user_id' => $user->id,
                'amount' => $data['amount'],
                'paid_at' => $data['paid_at'],
            ]);
            $paidAmount = $lockedDebt->paid_amount + $payment->amount;
            $isPaid = $paidAmount === $lockedDebt->amount;

            $lockedDebt->update([
                'paid_amount' => $paidAmount,
                'status' => $isPaid ? DebtStatus::Paid : DebtStatus::PartiallyPaid,
                'paid_at' => $isPaid ? $lockedDebt->payments()->max('paid_at') : null,
            ]);

            return [
                'created' => true,
                'payment' => $payment,
                'debt' => $lockedDebt->refresh(),
            ];
        }, attempts: 3);
    }
}
