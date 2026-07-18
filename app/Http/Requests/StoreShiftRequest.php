<?php

namespace App\Http\Requests;

use App\Models\Outlet;
use App\Models\Shift;
use App\Models\User;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * @phpstan-type ShiftPayload array{
 *     client_uuid: string,
 *     outlet_id: int,
 *     opening_cash: int,
 *     started_at: string
 * }
 */
class StoreShiftRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->tenant_id !== null
            && $this->user()->can('create', Shift::class);
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'client_uuid' => ['required', 'uuid'],
            'outlet_id' => ['required', 'integer', Rule::exists(Outlet::class, 'id')],
            'opening_cash' => ['required', 'integer', 'min:0'],
            'started_at' => ['required', 'date', 'before_or_equal:now'],
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
                $outletExists = Outlet::query()
                    ->accessibleTo($user)
                    ->whereKey($this->integer('outlet_id'))
                    ->where('tenant_id', $user->tenant_id)
                    ->where('is_active', true)
                    ->exists();

                if (! $outletExists) {
                    $validator->errors()->add('outlet_id', 'The selected outlet is invalid.');
                }
            },
        ];
    }

    /**
     * @return ShiftPayload
     */
    public function payload(): array
    {
        /** @var ShiftPayload $payload */
        $payload = $this->validated();

        return $payload;
    }
}
