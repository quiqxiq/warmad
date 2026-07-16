<?php

namespace App\Models;

use App\Enums\ShiftStatus;
use App\Models\Concerns\BelongsToTenant;
use Database\Factories\ShiftFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string|null $client_uuid
 * @property int $tenant_id
 * @property int $outlet_id
 * @property int $user_id
 * @property ShiftStatus $status
 * @property int $opening_cash
 * @property Carbon $started_at
 * @property Carbon|null $ended_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['client_uuid', 'tenant_id', 'outlet_id', 'user_id', 'status', 'opening_cash', 'started_at', 'ended_at'])]
class Shift extends Model
{
    use BelongsToTenant;

    /** @use HasFactory<ShiftFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => ShiftStatus::class,
            'opening_cash' => 'integer',
            'started_at' => 'datetime',
            'ended_at' => 'datetime',
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
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return HasMany<Transaction, covariant $this>
     */
    public function transactions(): HasMany
    {
        return $this->hasMany(Transaction::class);
    }

    /**
     * @return HasOne<CashReconciliation, covariant $this>
     */
    public function cashReconciliation(): HasOne
    {
        return $this->hasOne(CashReconciliation::class);
    }
}
