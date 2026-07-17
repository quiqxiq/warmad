<?php

namespace App\Policies;

use App\Models\CashReconciliation;
use App\Models\User;

/**
 * Reconciliations are created by whoever closes the register and are
 * immutable afterwards (append-only trail, PRD §6.4 & §10).
 */
class CashReconciliationPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, CashReconciliation $cashReconciliation): bool
    {
        return true;
    }

    public function create(User $user): bool
    {
        return true;
    }
}
