<?php

namespace App\Http\Requests;

use App\Enums\ShiftStatus;
use App\Models\Debt;
use App\Models\DebtPayment;
use App\Models\Shift;
use App\Models\User;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * @phpstan-type DebtPaymentPayload array{
 *     client_uuid: string,
 *     shift_id: int,
 *     amount: int,
 *     paid_at: string
 * }
 */
class StoreDebtPaymentRequest extends FormRequest
{
    public function authorize(): bool
    {
        $debt = $this->route('debt');

        return $debt instanceof Debt
            && $this->user()?->can('recordPayment', $debt) === true;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'client_uuid' => ['required', 'uuid'],
            'shift_id' => ['required', 'integer', Rule::exists(Shift::class, 'id')],
            'amount' => ['required', 'integer', 'min:1'],
            'paid_at' => ['required', 'date', 'before_or_equal:now'],
        ];
    }

    /**
     * @return array<Closure>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                if ($validator->errors()->isNotEmpty()) {
                    return;
                }

                /** @var Debt $debt */
                $debt = $this->route('debt');
                /** @var User $user */
                $user = $this->user();
                $existingPayment = DebtPayment::query()
                    ->where('tenant_id', $user->tenant_id)
                    ->where('client_uuid', $this->string('client_uuid')->toString())
                    ->exists();

                if ($existingPayment) {
                    return;
                }

                $shift = Shift::query()
                    ->whereKey($this->integer('shift_id'))
                    ->where('tenant_id', $user->tenant_id)
                    ->where('outlet_id', $debt->outlet_id)
                    ->whereBelongsTo($user)
                    ->where('status', ShiftStatus::Active)
                    ->first();

                if ($shift === null || $shift->cashReconciliation()->exists()) {
                    $validator->errors()->add('shift_id', 'The selected shift cannot receive this payment.');

                    return;
                }

                if ($shift->started_at->isAfter($this->date('paid_at'))) {
                    $validator->errors()->add('paid_at', 'The payment time must be within the selected shift.');
                }
            },
        ];
    }

    /**
     * @return DebtPaymentPayload
     */
    public function payload(): array
    {
        /** @var DebtPaymentPayload $payload */
        $payload = $this->validated();

        return $payload;
    }
}
