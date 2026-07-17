<?php

namespace App\Policies;

use App\Models\Debt;
use App\Models\User;

/**
 * Customer debts (bon) can be recorded and settled by any tenant member
 * on duty (PRD §6.5).
 */
class DebtPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, Debt $debt): bool
    {
        return true;
    }

    public function create(User $user): bool
    {
        return true;
    }

    public function update(User $user, Debt $debt): bool
    {
        return true;
    }
}
