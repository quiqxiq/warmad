<?php

namespace Database\Seeders;

use App\Enums\OutletUserRole;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class RoleSeeder extends Seeder
{
    /**
     * Seed the application-level roles (PRD §6.1: owner, penjaga).
     */
    public function run(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        foreach (OutletUserRole::cases() as $role) {
            Role::findOrCreate($role->value);
        }
    }
}
