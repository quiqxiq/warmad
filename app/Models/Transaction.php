<?php

namespace App\Models;

use App\Enums\InputMethod;
use App\Models\Concerns\BelongsToTenant;
use Database\Factories\TransactionFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string|null $client_uuid
 * @property string|null $sale_uuid
 * @property int $tenant_id
 * @property int $outlet_id
 * @property int $shift_id
 * @property int $category_id
 * @property int $user_id
 * @property string|null $barcode
 * @property int $quantity
 * @property int $unit_price
 * @property int $total_amount
 * @property int|null $payment_amount
 * @property int $change_amount
 * @property InputMethod $input_method
 * @property string|null $note
 * @property Carbon $occurred_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable([
    'client_uuid', 'sale_uuid', 'tenant_id', 'outlet_id', 'shift_id', 'category_id', 'user_id',
    'barcode', 'quantity', 'unit_price', 'total_amount', 'payment_amount', 'change_amount', 'input_method', 'note', 'occurred_at',
])]
class Transaction extends Model
{
    use BelongsToTenant;

    /** @use HasFactory<TransactionFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'quantity' => 'integer',
            'unit_price' => 'integer',
            'total_amount' => 'integer',
            'payment_amount' => 'integer',
            'change_amount' => 'integer',
            'input_method' => InputMethod::class,
            'occurred_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<Outlet, covariant $this>
     */
    public function outlet(): BelongsTo
    {
        return $this->belongsTo(Outlet::class);
    }

    /**
     * @return BelongsTo<Shift, covariant $this>
     */
    public function shift(): BelongsTo
    {
        return $this->belongsTo(Shift::class);
    }

    /**
     * @return BelongsTo<Category, covariant $this>
     */
    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    /**
     * @return BelongsTo<User, covariant $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
