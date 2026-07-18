<?php

use App\Enums\OutletUserRole;
use App\Models\Outlet;
use App\Models\Shift;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;

it('starts a shift idempotently with the client capture context', function () {
    $tenant = Tenant::factory()->create();
    $owner = User::factory()->create(['tenant_id' => $tenant->id]);
    $owner->assignRole(OutletUserRole::Owner->value);
    $outlet = Outlet::factory()->create(['tenant_id' => $tenant->id]);
    $payload = [
        'client_uuid' => (string) Str::uuid7(),
        'outlet_id' => $outlet->id,
        'opening_cash' => 150_000,
        'started_at' => now()->toISOString(),
    ];

    Sanctum::actingAs($owner);

    $this->postJson(route('shifts.store'), $payload)
        ->assertCreated()
        ->assertJsonPath('data.client_uuid', $payload['client_uuid'])
        ->assertJsonPath('data.opening_cash', 150_000);

    $this->postJson(route('shifts.store'), $payload)
        ->assertOk()
        ->assertJsonPath('data.client_uuid', $payload['client_uuid']);

    expect(Shift::query()->where('client_uuid', $payload['client_uuid'])->count())->toBe(1);
});

it('requires an idempotency key and capture time when starting a shift', function () {
    $tenant = Tenant::factory()->create();
    $owner = User::factory()->create(['tenant_id' => $tenant->id]);
    $owner->assignRole(OutletUserRole::Owner->value);
    $outlet = Outlet::factory()->create(['tenant_id' => $tenant->id]);

    Sanctum::actingAs($owner);

    $this->postJson(route('shifts.store'), [
        'outlet_id' => $outlet->id,
        'opening_cash' => 150_000,
    ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['client_uuid', 'started_at']);
});

it('does not mutate an existing shift when an idempotency key is retried', function () {
    $tenant = Tenant::factory()->create();
    $owner = User::factory()->create(['tenant_id' => $tenant->id]);
    $owner->assignRole(OutletUserRole::Owner->value);
    $outlet = Outlet::factory()->create(['tenant_id' => $tenant->id]);
    $payload = [
        'client_uuid' => (string) Str::uuid7(),
        'outlet_id' => $outlet->id,
        'opening_cash' => 150_000,
        'started_at' => now()->subMinute()->toISOString(),
    ];

    Sanctum::actingAs($owner);

    $this->postJson(route('shifts.store'), $payload)->assertCreated();
    $this->postJson(route('shifts.store'), [
        ...$payload,
        'opening_cash' => 999_000,
    ])
        ->assertOk()
        ->assertJsonPath('data.opening_cash', 150_000);

    expect(Shift::query()->sole()->opening_cash)->toBe(150_000);
});

it('rejects starting a shift at an inaccessible outlet', function () {
    $tenant = Tenant::factory()->create();
    $penjaga = User::factory()->create(['tenant_id' => $tenant->id]);
    $penjaga->assignRole(OutletUserRole::Penjaga->value);
    $outlet = Outlet::factory()->create(['tenant_id' => $tenant->id]);

    Sanctum::actingAs($penjaga);

    $this->postJson(route('shifts.store'), [
        'client_uuid' => (string) Str::uuid7(),
        'outlet_id' => $outlet->id,
        'opening_cash' => 100_000,
        'started_at' => now()->subMinute()->toISOString(),
    ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('outlet_id');

    expect(Shift::query()->count())->toBe(0);
});
