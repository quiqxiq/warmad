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

it('allows penjaga to update their own shift but denies updating others', function () {
    $ownShift = Shift::factory()->create([
        'tenant_id' => $this->tenant->id,
        'outlet_id' => $this->outlet->id,
        'user_id' => $this->penjaga->id,
        'status' => ShiftStatus::Active,
    ]);

    $otherShift = Shift::factory()->create([
        'tenant_id' => $this->tenant->id,
        'outlet_id' => $this->outlet->id,
        'user_id' => $this->otherPenjaga->id,
        'status' => ShiftStatus::Active,
    ]);

    // 1. Authenticate as Penjaga updating own shift -> Allowed
    Sanctum::actingAs($this->penjaga);
    $this->putJson("/api/shifts/{$ownShift->id}", [
        'status' => ShiftStatus::Closed->value,
        'ended_at' => now()->toIso8601String(),
    ])->assertOk();

    // 2. Authenticate as Penjaga updating another shift -> Denied
    $this->putJson("/api/shifts/{$otherShift->id}", [
        'status' => ShiftStatus::Closed->value,
        'ended_at' => now()->toIso8601String(),
    ])->assertForbidden();

    // 3. Authenticate as Owner updating another shift -> Allowed
    Sanctum::actingAs($this->owner);
    $this->putJson("/api/shifts/{$otherShift->id}", [
        'status' => ShiftStatus::Closed->value,
        'ended_at' => now()->toIso8601String(),
    ])->assertOk();
});
