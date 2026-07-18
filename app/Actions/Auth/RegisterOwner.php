<?php

namespace App\Actions\Auth;

use App\Enums\OutletUserRole;
use App\Models\Outlet;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Creates a brand-new owner account: a tenant, the owner user bound to it, the
 * owner role, and a first outlet. Runs in one transaction so a half-built
 * account can never exist. Phone-based signup (PRD §6.1) — no password needed.
 */
class RegisterOwner
{
    /**
     * @param  array{business_name: string, name: string, phone: string, outlet_name?: string|null}  $data
     */
    public function create(array $data): User
    {
        return DB::transaction(function () use ($data): User {
            $tenant = Tenant::create([
                'name' => $data['business_name'],
                'phone' => $data['phone'],
            ]);

            $user = User::create([
                'tenant_id' => $tenant->id,
                'name' => $data['name'],
                'phone' => $data['phone'],
            ]);

            // phone_verified_at is guarded, so set it directly — the caller
            // only reaches this point after a successful OTP verification.
            $user->forceFill(['phone_verified_at' => now()])->save();

            $user->assignRole(OutletUserRole::Owner->value);

            // tenant_id is set explicitly: the BelongsToTenant auto-fill relies
            // on an authenticated user, and no one is logged in during signup.
            $outlet = Outlet::create([
                'tenant_id' => $tenant->id,
                'name' => ($data['outlet_name'] ?? null) ?: $data['business_name'],
            ]);

            $outlet->users()->attach($user, ['role' => OutletUserRole::Owner->value]);

            return $user;
        });
    }
}
