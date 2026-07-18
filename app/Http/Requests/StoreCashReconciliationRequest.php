<?php

namespace App\Http\Requests;

use App\Enums\ShiftStatus;
use App\Models\CashReconciliation;
use App\Models\Shift;
use App\Models\User;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * @phpstan-type CashReconciliationPayload array{
 *     client_uuid: string,
 *     shift_id: int,
 *     actual_cash: int,
 *     note?: string|null
 * }
 */
class StoreCashReconciliationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->tenant_id !== null
            && $this->user()->can('create', CashReconciliation::class);
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'client_uuid' => ['required', 'uuid'],
            'shift_id' => ['required', 'integer', Rule::exists(Shift::class, 'id')],
            'actual_cash' => ['required', 'integer', 'min:0'],
            'note' => ['nullable', 'string', 'max:1000'],
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

                /** @var User $user */
                $user = $this->user();
                $existingReconciliation = CashReconciliation::query()
                    ->where('tenant_id', $user->tenant_id)
                    ->where('client_uuid', $this->string('client_uuid')->toString())
                    ->exists();

                if ($existingReconciliation) {
                    return;
                }

                $shift = Shift::query()
                    ->whereKey($this->integer('shift_id'))
                    ->where('tenant_id', $user->tenant_id)
                    ->where('status', ShiftStatus::Active)
                    ->first();

                if ($shift === null || ! $user->can('update', $shift)) {
                    $validator->errors()->add('shift_id', 'The selected shift cannot be reconciled.');

                    return;
                }

                if ($shift->cashReconciliation()->exists()) {
                    $validator->errors()->add('shift_id', 'The selected shift has already been reconciled.');
                }
            },
        ];
    }

    /**
     * @return CashReconciliationPayload
     */
    public function payload(): array
    {
        /** @var CashReconciliationPayload $payload */
        $payload = $this->validated();

        return $payload;
    }
}
