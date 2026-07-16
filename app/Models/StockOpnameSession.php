<?php

namespace App\Models;

use App\Enums\OpnameSessionStatus;
use App\Enums\OpnameSessionType;
use App\Models\Concerns\BelongsToTenant;
use Database\Factories\StockOpnameSessionFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $tenant_id
 * @property int $outlet_id
 * @property OpnameSessionType $type
 * @property OpnameSessionStatus $status
 * @property int|null $outgoing_user_id
 * @property int|null $incoming_user_id
 * @property Carbon|null $outgoing_confirmed_at
 * @property Carbon|null $incoming_confirmed_at
 * @property int|null $total_value
 * @property Carbon|null $finalized_at
 * @property string|null $note
 * @property int|null $created_by
 * @property int|null $updated_by
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable([
    'tenant_id', 'outlet_id', 'type', 'status', 'outgoing_user_id', 'incoming_user_id',
    'outgoing_confirmed_at', 'incoming_confirmed_at', 'total_value', 'finalized_at',
    'note', 'created_by', 'updated_by',
])]
class StockOpnameSession extends Model
{
    use BelongsToTenant;

    /** @use HasFactory<StockOpnameSessionFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'type' => OpnameSessionType::class,
            'status' => OpnameSessionStatus::class,
            'outgoing_confirmed_at' => 'datetime',
            'incoming_confirmed_at' => 'datetime',
            'total_value' => 'integer',
            'finalized_at' => 'datetime',
        ];
    }

    /**
     * A handover session can only be finalized once both parties confirm
     * (PRD §6.2 acceptance criteria).
     */
    public function isFullyConfirmed(): bool
    {
        return $this->outgoing_confirmed_at !== null
            && $this->incoming_confirmed_at !== null;
    }

    /**
     * @return BelongsTo<Outlet, covariant $this>
     */
    public function outlet(): BelongsTo
    {
        return $this->belongsTo(Outlet::class);
    }

    /**
     * @return HasMany<StockOpnameItem, covariant $this>
     */
    public function items(): HasMany
    {
        return $this->hasMany(StockOpnameItem::class);
    }

    /**
     * @return BelongsTo<User, covariant $this>
     */
    public function outgoingUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'outgoing_user_id');
    }

    /**
     * @return BelongsTo<User, covariant $this>
     */
    public function incomingUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'incoming_user_id');
    }
}
