<?php

use App\Enums\OutletUserRole;
use App\Models\Outlet;
use App\Models\Tenant;
use App\Models\User;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    $this->tenant = Tenant::factory()->create();
    $this->user = User::factory()->create(['tenant_id' => $this->tenant->id]);
    $this->user->assignRole(OutletUserRole::Owner->value);

    Sanctum::actingAs($this->user);
});

it('lists only the tenant outlets', function () {
    Outlet::factory()->count(2)->create(['tenant_id' => $this->tenant->id]);
    Outlet::factory()->create();

    $this->getJson('/api/outlets')
        ->assertOk()
        ->assertJsonCount(2, 'data');
});

it('creates an outlet for the tenant', function () {
    $this->postJson('/api/outlets', [
        'name' => 'Warung Anyar',
        'address' => 'Jl. Raya Madura No. 1',
    ])
        ->assertCreated()
        ->assertJsonPath('data.name', 'Warung Anyar');

    $this->assertDatabaseHas('outlets', [
        'name' => 'Warung Anyar',
        'tenant_id' => $this->tenant->id,
    ]);
});

it('rejects an outlet without a name', function () {
    $this->postJson('/api/outlets', ['address' => 'Tanpa nama'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('name');
});

it('blocks access to another tenant outlet', function () {
    $foreignOutlet = Outlet::factory()->create();

    $this->getJson("/api/outlets/{$foreignOutlet->id}")
        ->assertNotFound();
});

it('requires authentication', function () {
    Sanctum::actingAs($this->user); // reset then flush below

    $this->app['auth']->forgetGuards();

    $this->getJson('/api/outlets')->assertUnauthorized();
});
