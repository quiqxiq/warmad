<?php

namespace App\Policies;

use App\Enums\OutletUserRole;
use App\Models\Category;
use App\Models\User;

/**
 * Category buttons (incl. default prices) are configured by the owner;
 * penjaga only reads them for the transaction screen (PRD §6.3).
 */
class CategoryPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, Category $category): bool
    {
        return true;
    }

    public function create(User $user): bool
    {
        return $user->hasRole(OutletUserRole::Owner->value);
    }

    public function update(User $user, Category $category): bool
    {
        return $user->hasRole(OutletUserRole::Owner->value);
    }

    public function delete(User $user, Category $category): bool
    {
        return $user->hasRole(OutletUserRole::Owner->value);
    }
}
