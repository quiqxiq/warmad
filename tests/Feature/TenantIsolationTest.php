<?php

use App\Models\Outlet;
use App\Models\Tenant;
use App\Models\User;

it('scopes outlet queries to the authenticated tenant', function () {
    $tenantA = Tenant::factory()->create();
    $tenantB = Tenant::factory()->create();

    $outletA = Outlet::factory()->create(['tenant_id' => $tenantA->id]);
    Outlet::factory()->create(['tenant_id' => $tenantB->id]);

    $userA = User::factory()->create(['tenant_id' => $tenantA->id]);

    $this->actingAs($userA);

    expect(Outlet::all())->toHaveCount(1)
        ->and(Outlet::first()->id)->toBe($outletA->id);
});

it('fills tenant_id automatically when creating through an authenticated user', function () {
    $tenant = Tenant::factory()->create();
    $user = User::factory()->create(['tenant_id' => $tenant->id]);

    $this->actingAs($user);

    $outlet = Outlet::create(['name' => 'Warung Baru']);

    expect($outlet->tenant_id)->toBe($tenant->id);
});

it('does not scope queries for guests', function () {
    Outlet::factory()->count(2)->create();

    expect(Outlet::all())->toHaveCount(2);
});
