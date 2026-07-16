<?php

namespace App\Models;

use App\Enums\DebtStatus;
use App\Models\Concerns\BelongsToTenant;
use Database\Factories\DebtFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string|null $client_uuid
 * @property int $tenant_id
 * @property int $outlet_id
 * @property string $customer_name
 * @property int $amount
 * @property int $paid_amount
 * @property DebtStatus $status
 * @property Carbon $incurred_at
 * @property Carbon|null $paid_at
 * @property string|null $note
 * @property int|null $created_by
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable([
    'client_uuid', 'tenant_id', 'outlet_id', 'customer_name', 'amount',
    'paid_amount', 'status', 'incurred_at', 'paid_at', 'note', 'created_by',
])]
class Debt extends Model
{
    use BelongsToTenant;

    /** @use HasFactory<DebtFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'amount' => 'integer',
            'paid_amount' => 'integer',
            'status' => DebtStatus::class,
            'incurred_at' => 'date',
            'paid_at' => 'datetime',
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
     * @return BelongsTo<User, covariant $this>
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
