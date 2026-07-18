<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Database\Factories\DebtPaymentFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $client_uuid
 * @property int $tenant_id
 * @property int $outlet_id
 * @property int $debt_id
 * @property int $shift_id
 * @property int $user_id
 * @property int $amount
 * @property Carbon $paid_at
 * @property Carbon|null $created_at
 */
#[Fillable([
    'client_uuid', 'tenant_id', 'outlet_id', 'debt_id', 'shift_id', 'user_id',
    'amount', 'paid_at',
])]
class DebtPayment extends Model
{
    use BelongsToTenant;

    /** @use HasFactory<DebtPaymentFactory> */
    use HasFactory;

    public const UPDATED_AT = null;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'amount' => 'integer',
            'paid_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<Debt, covariant $this>
     */
    public function debt(): BelongsTo
    {
        return $this->belongsTo(Debt::class);
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
     * @return BelongsTo<User, covariant $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
