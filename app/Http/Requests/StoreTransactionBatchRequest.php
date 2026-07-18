<?php

namespace App\Http\Requests;

use App\Enums\InputMethod;
use App\Enums\ShiftStatus;
use App\Models\Category;
use App\Models\Outlet;
use App\Models\Shift;
use App\Models\Transaction;
use App\Models\User;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * @phpstan-type TransactionBatchItem array{
 *     category_id: int,
 *     quantity: int,
 *     unit_price: int
 * }
 * @phpstan-type TransactionBatchPayload array{
 *     client_uuid: string,
 *     outlet_id: int,
 *     shift_id: int,
 *     items: list<TransactionBatchItem>,
 *     payment_amount?: int|null,
 *     customer_name?: string|null,
 *     input_method: string,
 *     note?: string|null,
 *     occurred_at: string
 * }
 */
class StoreTransactionBatchRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        $user = $this->user();

        return $user?->tenant_id !== null
            && $user->can('create', Transaction::class);
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'client_uuid' => ['required', 'uuid'],
            'outlet_id' => ['required', 'integer', Rule::exists(Outlet::class, 'id')],
            'shift_id' => ['required', 'integer', Rule::exists(Shift::class, 'id')],
            'items' => ['required', 'array', 'list', 'min:1', 'max:50'],
            'items.*.category_id' => ['required', 'integer', Rule::exists(Category::class, 'id')],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
            'items.*.unit_price' => ['required', 'integer', 'min:0'],
            'payment_amount' => ['sometimes', 'nullable', 'integer', 'min:0'],
            'customer_name' => ['nullable', 'string', 'max:255'],
            'input_method' => ['required', Rule::enum(InputMethod::class)],
            'note' => ['nullable', 'string', 'max:255'],
            'occurred_at' => ['required', 'date'],
        ];
    }

    /**
     * Validate aggregate payment rules and outlet ownership relationships.
     *
     * @return array<Closure>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                if ($validator->errors()->isNotEmpty()) {
                    return;
                }

                /** @var TransactionBatchPayload $data */
                $data = $validator->validated();
                $totalAmount = 0;

                foreach ($data['items'] as $item) {
                    $totalAmount += $item['quantity'] * $item['unit_price'];
                }

                $paymentAmount = $data['payment_amount'] ?? $totalAmount;

                if ($paymentAmount < $totalAmount && blank($data['customer_name'] ?? null)) {
                    $validator->errors()->add(
                        'customer_name',
                        'The customer name field is required when the payment is less than the total.',
                    );
                }

                /** @var User|null $user */
                $user = $this->user();
                $tenantId = $user?->tenant_id;
                $outlet = $user === null
                    ? null
                    : Outlet::query()
                        ->accessibleTo($user)
                        ->whereKey($data['outlet_id'])
                        ->where('tenant_id', $tenantId)
                        ->where('is_active', true)
                        ->first();

                if ($outlet === null) {
                    $validator->errors()->add('outlet_id', 'The selected outlet is invalid.');

                    return;
                }

                $shiftExists = Shift::query()
                    ->whereKey($data['shift_id'])
                    ->where('tenant_id', $tenantId)
                    ->whereBelongsTo($outlet)
                    ->whereBelongsTo($user)
                    ->where('status', ShiftStatus::Active)
                    ->exists();

                if (! $shiftExists) {
                    $validator->errors()->add('shift_id', 'The selected shift does not belong to this outlet.');
                }

                $categoryIds = Category::query()
                    ->where('tenant_id', $tenantId)
                    ->whereBelongsTo($outlet)
                    ->where('is_active', true)
                    ->whereIn('id', collect($data['items'])->pluck('category_id'))
                    ->pluck('id')
                    ->all();

                foreach ($data['items'] as $index => $item) {
                    if (! in_array($item['category_id'], $categoryIds, true)) {
                        $validator->errors()->add(
                            "items.{$index}.category_id",
                            'The selected category does not belong to this outlet.',
                        );
                    }
                }
            },
        ];
    }

    /**
     * Return the validated, type-safe batch payload.
     *
     * @return TransactionBatchPayload
     */
    public function payload(): array
    {
        /** @var TransactionBatchPayload $payload */
        $payload = $this->validated();

        return $payload;
    }
}
