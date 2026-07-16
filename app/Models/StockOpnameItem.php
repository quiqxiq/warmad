<?php

namespace App\Models;

use App\Enums\InputMethod;
use Database\Factories\StockOpnameItemFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Tenant isolation is inherited through the parent session, so this model
 * intentionally does not use BelongsToTenant.
 *
 * @property int $id
 * @property string|null $client_uuid
 * @property int $stock_opname_session_id
 * @property string $section
 * @property string $name
 * @property string|null $barcode
 * @property numeric-string $quantity
 * @property int $unit_price
 * @property InputMethod $input_method
 * @property string|null $photo_before_path
 * @property string|null $photo_after_path
 * @property string|null $dispute_note
 * @property int|null $counted_by
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable([
    'client_uuid', 'stock_opname_session_id', 'section', 'name', 'barcode', 'quantity',
    'unit_price', 'input_method', 'photo_before_path', 'photo_after_path', 'dispute_note', 'counted_by',
])]
class StockOpnameItem extends Model
{
    /** @use HasFactory<StockOpnameItemFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:2',
            'unit_price' => 'integer',
            'input_method' => InputMethod::class,
        ];
    }

    /**
     * @return BelongsTo<StockOpnameSession, covariant $this>
     */
    public function session(): BelongsTo
    {
        return $this->belongsTo(StockOpnameSession::class, 'stock_opname_session_id');
    }

    /**
     * @return BelongsTo<User, covariant $this>
     */
    public function counter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'counted_by');
    }
}
