<?php

namespace App\Policies;

use App\Enums\OutletUserRole;
use App\Models\Outlet;
use App\Models\User;

/**
 * Outlet management is owner-only; penjaga may only view outlets of
 * their tenant (tenant isolation itself is handled by BelongsToTenant).
 */
class OutletPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, Outlet $outlet): bool
    {
        return true;
    }

    public function create(User $user): bool
    {
        return $user->hasRole(OutletUserRole::Owner->value);
    }

    public function update(User $user, Outlet $outlet): bool
    {
        return $user->hasRole(OutletUserRole::Owner->value);
    }

    public function delete(User $user, Outlet $outlet): bool
    {
        return $user->hasRole(OutletUserRole::Owner->value);
    }
}
