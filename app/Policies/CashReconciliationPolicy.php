<?php

namespace App\Policies;

use App\Models\CashReconciliation;
use App\Models\Outlet;
use App\Models\User;

/**
 * Reconciliations are created by whoever closes the register and are
 * immutable afterwards (append-only trail, PRD §6.4 & §10).
 */
class CashReconciliationPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->tenant_id !== null;
    }

    public function view(User $user, CashReconciliation $cashReconciliation): bool
    {
        return $user->tenant_id !== null
            && Outlet::query()
                ->accessibleTo($user)
                ->whereKey($cashReconciliation->outlet_id)
                ->exists();
    }

    public function create(User $user): bool
    {
        return $user->tenant_id !== null;
    }
}
