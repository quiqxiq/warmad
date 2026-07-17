<?php

namespace App\Policies;

use App\Models\Transaction;
use App\Models\User;

/**
 * Any authenticated tenant member may record and view transactions.
 * Transactions are immutable once recorded — no update/delete at all
 * (auditability, PRD §10).
 */
class TransactionPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, Transaction $transaction): bool
    {
        return true;
    }

    public function create(User $user): bool
    {
        return true;
    }
}
