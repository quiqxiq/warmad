<?php

namespace App\Policies;

use App\Enums\OutletUserRole;
use App\Models\Outlet;
use App\Models\Shift;
use App\Models\User;

/**
 * Penjaga run their own shifts; the owner can manage any shift in the
 * tenant (e.g. closing a stuck shift).
 */
class ShiftPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->tenant_id !== null;
    }

    public function view(User $user, Shift $shift): bool
    {
        return $this->canAccessOutlet($user, $shift->outlet_id);
    }

    public function create(User $user): bool
    {
        return $user->tenant_id !== null;
    }

    public function update(User $user, Shift $shift): bool
    {
        return $this->canAccessOutlet($user, $shift->outlet_id)
            && ($user->hasRole(OutletUserRole::Owner->value) || $shift->user_id === $user->id);
    }

    private function canAccessOutlet(User $user, int $outletId): bool
    {
        return $user->tenant_id !== null
            && Outlet::query()->accessibleTo($user)->whereKey($outletId)->exists();
    }
}
