<?php

namespace App\Models;

use App\Enums\ReconciliationStatus;
use App\Models\Concerns\Auditable;
use App\Models\Concerns\BelongsToTenant;
use Database\Factories\CashReconciliationFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $tenant_id
 * @property int $outlet_id
 * @property int $shift_id
 * @property int $expected_cash
 * @property int $actual_cash
 * @property int $difference
 * @property ReconciliationStatus $status
 * @property string|null $note
 * @property int|null $created_by
 * @property int|null $updated_by
 * @property Carbon $reconciled_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable([
    'tenant_id', 'outlet_id', 'shift_id', 'expected_cash', 'actual_cash',
    'difference', 'status', 'note', 'created_by', 'updated_by', 'reconciled_at',
])]
class CashReconciliation extends Model
{
    use Auditable;
    use BelongsToTenant;

    /** @use HasFactory<CashReconciliationFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'expected_cash' => 'integer',
            'actual_cash' => 'integer',
            'difference' => 'integer',
            'status' => ReconciliationStatus::class,
            'reconciled_at' => 'datetime',
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
     * @return BelongsTo<User, covariant $this>
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
