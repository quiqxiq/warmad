<?php

namespace App\Support;

use App\Enums\OutletUserRole;
use App\Models\User;

/**
 * Resolves the post-login landing route per role. Penjaga go straight to the
 * cashier workspace (the only screen they need); owners land on the dashboard.
 */
class HomeRoute
{
    public static function for(User $user): string
    {
        if ($user->hasRole(OutletUserRole::Owner->value)) {
            return route('dashboard', absolute: false);
        }

        return route('cashier.index', absolute: false);
    }
}
