<?php

namespace App\Models;

use App\Enums\OutletUserRole;
use App\Models\Concerns\BelongsToTenant;
use Database\Factories\OutletFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $tenant_id
 * @property string $name
 * @property string|null $address
 * @property bool $is_active
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['tenant_id', 'name', 'address', 'is_active'])]
class Outlet extends Model
{
    use BelongsToTenant;

    /** @use HasFactory<OutletFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    /**
     * Scope outlets to those the user may operate.
     *
     * @param  Builder<Outlet>  $query
     * @return Builder<Outlet>
     */
    public function scopeAccessibleTo(Builder $query, User $user): Builder
    {
        if ($user->hasRole(OutletUserRole::Owner->value)) {
            return $query;
        }

        return $query->whereHas('users', fn (Builder $users): Builder => $users->whereKey($user->id));
    }

    /**
     * @return BelongsToMany<User, covariant $this>
     */
    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class)
            ->withPivot('role')
            ->withTimestamps();
    }

    /**
     * @return BelongsToMany<User, covariant $this>
     */
    public function penjagas(): BelongsToMany
    {
        return $this->users()->wherePivot('role', OutletUserRole::Penjaga->value);
    }

    /**
     * @return HasMany<Shift, covariant $this>
     */
    public function shifts(): HasMany
    {
        return $this->hasMany(Shift::class);
    }

    /**
     * @return HasMany<Category, covariant $this>
     */
    public function categories(): HasMany
    {
        return $this->hasMany(Category::class);
    }

    /**
     * @return HasMany<Transaction, covariant $this>
     */
    public function transactions(): HasMany
    {
        return $this->hasMany(Transaction::class);
    }

    /**
     * @return HasMany<CashReconciliation, covariant $this>
     */
    public function cashReconciliations(): HasMany
    {
        return $this->hasMany(CashReconciliation::class);
    }

    /**
     * @return HasMany<Debt, covariant $this>
     */
    public function debts(): HasMany
    {
        return $this->hasMany(Debt::class);
    }

    /**
     * @return HasMany<StockOpnameSession, covariant $this>
     */
    public function stockOpnameSessions(): HasMany
    {
        return $this->hasMany(StockOpnameSession::class);
    }
}
