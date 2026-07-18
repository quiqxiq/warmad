<?php

namespace App\Policies;

use App\Models\Debt;
use App\Models\Outlet;
use App\Models\User;

/**
 * Customer debts (bon) can be recorded and settled by any tenant member
 * on duty (PRD §6.5).
 */
class DebtPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->tenant_id !== null;
    }

    public function view(User $user, Debt $debt): bool
    {
        return $this->canAccessOutlet($user, $debt->outlet_id);
    }

    public function create(User $user): bool
    {
        return $user->tenant_id !== null;
    }

    public function recordPayment(User $user, Debt $debt): bool
    {
        return $this->canAccessOutlet($user, $debt->outlet_id);
    }

    private function canAccessOutlet(User $user, int $outletId): bool
    {
        return $user->tenant_id !== null
            && Outlet::query()->accessibleTo($user)->whereKey($outletId)->exists();
    }
}
