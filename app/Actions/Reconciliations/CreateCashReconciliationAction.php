<?php

namespace App\Actions\Reconciliations;

use App\Enums\ReconciliationStatus;
use App\Enums\ShiftStatus;
use App\Models\CashReconciliation;
use App\Models\Shift;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use LogicException;

class CreateCashReconciliationAction
{
    private const int AUTO_APPROVE_TOLERANCE = 10_000;

    /**
     * @param  array{client_uuid: string, shift_id: int, actual_cash: int, note?: string|null}  $data
     * @return array{created: bool, reconciliation: CashReconciliation}
     */
    public function handle(array $data, User $user): array
    {
        $tenantId = $user->tenant_id;

        if ($tenantId === null) {
            throw new LogicException('A tenant is required to reconcile cash.');
        }

        return DB::transaction(function () use ($data, $user, $tenantId): array {
            Tenant::query()
                ->whereKey($tenantId)
                ->lockForUpdate()
                ->firstOrFail();

            $existingReconciliation = CashReconciliation::query()
                ->where('tenant_id', $tenantId)
                ->where('client_uuid', $data['client_uuid'])
                ->first();

            if ($existingReconciliation !== null) {
                if (
                    $existingReconciliation->shift_id !== $data['shift_id']
                    || $existingReconciliation->actual_cash !== $data['actual_cash']
                    || $existingReconciliation->note !== ($data['note'] ?? null)
                ) {
                    throw ValidationException::withMessages([
                        'client_uuid' => ['This idempotency key was already used for another reconciliation.'],
                    ]);
                }

                return [
                    'created' => false,
                    'reconciliation' => $existingReconciliation,
                ];
            }

            $shift = Shift::query()
                ->whereKey($data['shift_id'])
                ->where('tenant_id', $tenantId)
                ->lockForUpdate()
                ->first();

            if (
                $shift === null
                || $shift->status !== ShiftStatus::Active
                || ! $user->can('update', $shift)
                || $shift->cashReconciliation()->exists()
            ) {
                throw ValidationException::withMessages([
                    'shift_id' => ['The selected shift cannot be reconciled.'],
                ]);
            }

            $retainedCash = (int) $shift->transactions()
                ->selectRaw('COALESCE(SUM(CASE WHEN payment_amount IS NULL OR payment_amount > total_amount THEN total_amount ELSE payment_amount END), 0) as retained_cash')
                ->value('retained_cash');
            $debtPaymentCash = (int) $shift->debtPayments()->sum('amount');
            $expectedCash = $shift->opening_cash + $retainedCash + $debtPaymentCash;
            $difference = $data['actual_cash'] - $expectedCash;
            $withinTolerance = abs($difference) <= self::AUTO_APPROVE_TOLERANCE;

            if (! $withinTolerance && blank($data['note'] ?? null)) {
                throw ValidationException::withMessages([
                    'note' => ['Catatan alasan wajib diisi untuk selisih besar.'],
                ]);
            }

            $reconciliation = CashReconciliation::create([
                'client_uuid' => $data['client_uuid'],
                'tenant_id' => $tenantId,
                'outlet_id' => $shift->outlet_id,
                'shift_id' => $shift->id,
                'expected_cash' => $expectedCash,
                'actual_cash' => $data['actual_cash'],
                'difference' => $difference,
                'status' => $withinTolerance
                    ? ReconciliationStatus::AutoApproved
                    : ReconciliationStatus::Explained,
                'note' => $data['note'] ?? null,
                'created_by' => $user->id,
                'reconciled_at' => now(),
            ]);

            $shift->update([
                'status' => ShiftStatus::Closed,
                'ended_at' => now(),
            ]);

            return [
                'created' => true,
                'reconciliation' => $reconciliation,
            ];
        }, attempts: 3);
    }
}
