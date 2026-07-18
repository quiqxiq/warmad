<?php

use App\Models\Outlet;
use App\Models\Tenant;
use App\Models\User;

it('scopes queries to the authenticated user tenant', function () {
    $tenantA = Tenant::factory()->create();
    $tenantB = Tenant::factory()->create();

    Outlet::factory()->create(['tenant_id' => $tenantA->id]);
    Outlet::factory()->create(['tenant_id' => $tenantB->id]);

    $userA = User::factory()->create(['tenant_id' => $tenantA->id]);

    $this->actingAs($userA);

    expect(Outlet::query()->count())->toBe(1);
    expect(Outlet::query()->first()->tenant_id)->toBe($tenantA->id);
});

it('fails closed: a tenantless authenticated user sees no tenant data', function () {
    $tenant = Tenant::factory()->create();
    Outlet::factory()->create(['tenant_id' => $tenant->id]);

    $orphan = User::factory()->create(['tenant_id' => null]);

    $this->actingAs($orphan);

    expect(Outlet::query()->count())->toBe(0);
});
