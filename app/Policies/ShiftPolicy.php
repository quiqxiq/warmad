<?php

namespace App\Policies;

use App\Enums\OutletUserRole;
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
        return true;
    }

    public function view(User $user, Shift $shift): bool
    {
        return true;
    }

    public function create(User $user): bool
    {
        return true;
    }

    public function update(User $user, Shift $shift): bool
    {
        return $user->hasRole(OutletUserRole::Owner->value)
            || $shift->user_id === $user->id;
    }
}
