<?php

use App\Enums\OutletUserRole;
use App\Models\Outlet;
use App\Models\Tenant;
use App\Models\User;

beforeEach(function () {
    $this->tenant = Tenant::factory()->create();
    $this->outlet = Outlet::factory()->create(['tenant_id' => $this->tenant->id]);

    $this->owner = User::factory()->create(['tenant_id' => $this->tenant->id]);
    $this->owner->assignRole(OutletUserRole::Owner->value);

    $this->penjaga = User::factory()->create(['tenant_id' => $this->tenant->id]);
    $this->penjaga->assignRole(OutletUserRole::Penjaga->value);
});

it('lets an owner add a penjaga bound to the tenant and outlet', function () {
    $this->actingAs($this->owner)
        ->post(route('penjaga.store'), [
            'name' => 'Kasir Andi',
            'phone' => '081200002222',
            'outlet_id' => $this->outlet->id,
        ])
        ->assertRedirect(route('penjaga.index'));

    $created = User::query()->where('phone', '6281200002222')->firstOrFail();

    expect($created->tenant_id)->toBe($this->tenant->id);
    expect($created->hasRole(OutletUserRole::Penjaga->value))->toBeTrue();
    expect($created->outlets()->whereKey($this->outlet->id)->exists())->toBeTrue();
});

it('forbids a penjaga from adding another penjaga', function () {
    $this->actingAs($this->penjaga)
        ->post(route('penjaga.store'), [
            'name' => 'Kasir Nakal',
            'phone' => '081200003333',
            'outlet_id' => $this->outlet->id,
        ])
        ->assertForbidden();

    expect(User::query()->where('phone', '6281200003333')->exists())->toBeFalse();
});

it('rejects a duplicate phone number', function () {
    $this->actingAs($this->owner)
        ->post(route('penjaga.store'), [
            'name' => 'Duplikat',
            'phone' => $this->penjaga->phone,
            'outlet_id' => $this->outlet->id,
        ])
        ->assertSessionHasErrors('phone');
});

it('lets an owner remove a penjaga in their tenant', function () {
    $this->actingAs($this->owner)
        ->delete(route('penjaga.destroy', $this->penjaga))
        ->assertRedirect(route('penjaga.index'));

    expect(User::query()->whereKey($this->penjaga->id)->exists())->toBeFalse();
});

it('forbids removing a penjaga from another tenant', function () {
    $otherTenant = Tenant::factory()->create();
    $otherPenjaga = User::factory()->create(['tenant_id' => $otherTenant->id]);
    $otherPenjaga->assignRole(OutletUserRole::Penjaga->value);

    $this->actingAs($this->owner)
        ->delete(route('penjaga.destroy', $otherPenjaga))
        ->assertForbidden();

    expect(User::query()->whereKey($otherPenjaga->id)->exists())->toBeTrue();
});
