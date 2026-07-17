<?php

namespace App\Policies;

use App\Enums\OutletUserRole;
use App\Models\StockOpnameSession;
use App\Models\User;

/**
 * Opname sessions are opened by the owner or involved penjaga; item edits
 * and confirmation are limited to session participants (PRD §6.2).
 */
class StockOpnameSessionPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, StockOpnameSession $stockOpnameSession): bool
    {
        return true;
    }

    public function create(User $user): bool
    {
        return true;
    }

    public function update(User $user, StockOpnameSession $stockOpnameSession): bool
    {
        return $user->hasRole(OutletUserRole::Owner->value)
            || $this->isParticipant($user, $stockOpnameSession);
    }

    public function addItem(User $user, StockOpnameSession $stockOpnameSession): bool
    {
        return $user->hasRole(OutletUserRole::Owner->value)
            || $this->isParticipant($user, $stockOpnameSession);
    }

    private function isParticipant(User $user, StockOpnameSession $session): bool
    {
        return in_array($user->id, [$session->outgoing_user_id, $session->incoming_user_id], true);
    }
}
