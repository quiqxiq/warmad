<?php

use App\Enums\OutletUserRole;
use App\Enums\ShiftStatus;
use App\Models\Outlet;
use App\Models\Shift;
use App\Models\Tenant;
use App\Models\User;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    $this->tenant = Tenant::factory()->create();
    $this->outlet = Outlet::factory()->create(['tenant_id' => $this->tenant->id]);

    $this->owner = User::factory()->create(['tenant_id' => $this->tenant->id]);
    $this->owner->assignRole(OutletUserRole::Owner->value);

    $this->penjaga = User::factory()->create(['tenant_id' => $this->tenant->id]);
    $this->penjaga->assignRole(OutletUserRole::Penjaga->value);

    $this->otherPenjaga = User::factory()->create(['tenant_id' => $this->tenant->id]);
    $this->otherPenjaga->assignRole(OutletUserRole::Penjaga->value);

    $this->penjaga->outlets()->attach($this->outlet, ['role' => OutletUserRole::Penjaga->value]);
    $this->otherPenjaga->outlets()->attach($this->outlet, ['role' => OutletUserRole::Penjaga->value]);
});

it('allows owner to create category but denies penjaga', function () {
    // 1. Authenticate as Penjaga -> Denied
    Sanctum::actingAs($this->penjaga);
    $this->postJson('/api/categories', [
        'outlet_id' => $this->outlet->id,
        'name' => 'Kategori Baru',
        'default_price' => 10000,
    ])->assertForbidden();

    // 2. Authenticate as Owner -> Allowed
    Sanctum::actingAs($this->owner);
    $this->postJson('/api/categories', [
        'outlet_id' => $this->outlet->id,
        'name' => 'Kategori Baru',
        'default_price' => 10000,
    ])->assertCreated();
});

it('requires reconciliation instead of direct shift closure', function () {
    $shift = Shift::factory()->create([
        'tenant_id' => $this->tenant->id,
        'outlet_id' => $this->outlet->id,
        'user_id' => $this->penjaga->id,
        'status' => ShiftStatus::Active,
    ]);

    Sanctum::actingAs($this->penjaga);

    $this->putJson("/api/shifts/{$shift->id}", [
        'status' => ShiftStatus::Closed->value,
        'ended_at' => now()->toIso8601String(),
    ])->assertMethodNotAllowed();

    expect($shift->refresh()->status)->toBe(ShiftStatus::Active);
});
