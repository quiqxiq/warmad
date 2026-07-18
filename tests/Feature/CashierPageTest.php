<?php

use App\Enums\DebtStatus;
use App\Enums\OutletUserRole;
use App\Enums\ShiftStatus;
use App\Models\Category;
use App\Models\Debt;
use App\Models\Outlet;
use App\Models\Shift;
use App\Models\Tenant;
use App\Models\Transaction;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->withoutVite();
});

it('redirects guests from the cashier page', function () {
    $this->get(route('cashier.index'))->assertRedirect(route('login'));
});

it('renders the cashier data for the selected accessible outlet', function () {
    $tenant = Tenant::factory()->create();
    $owner = User::factory()->create(['tenant_id' => $tenant->id]);
    $owner->assignRole(OutletUserRole::Owner->value);
    $firstOutlet = Outlet::factory()->create(['tenant_id' => $tenant->id, 'name' => 'Alpha']);
    $selectedOutlet = Outlet::factory()->create(['tenant_id' => $tenant->id, 'name' => 'Beta']);
    Outlet::factory()->create([
        'tenant_id' => $tenant->id,
        'name' => 'Inactive',
        'is_active' => false,
    ]);
    $activeShift = Shift::factory()->create([
        'tenant_id' => $tenant->id,
        'outlet_id' => $selectedOutlet->id,
        'user_id' => $owner->id,
        'status' => ShiftStatus::Active,
    ]);
    $firstCategory = Category::factory()->create([
        'tenant_id' => $tenant->id,
        'outlet_id' => $selectedOutlet->id,
        'name' => 'Minuman',
        'position' => 10,
        'is_active' => true,
    ]);
    $activeCategory = Category::factory()->create([
        'tenant_id' => $tenant->id,
        'outlet_id' => $selectedOutlet->id,
        'name' => 'Rokok',
        'position' => 20,
        'is_active' => true,
    ]);
    Category::factory()->create([
        'tenant_id' => $tenant->id,
        'outlet_id' => $selectedOutlet->id,
        'is_active' => false,
    ]);
    $saleUuid = fake()->uuid();
    Transaction::factory()->create([
        'sale_uuid' => $saleUuid,
        'tenant_id' => $tenant->id,
        'outlet_id' => $selectedOutlet->id,
        'shift_id' => $activeShift->id,
        'category_id' => $activeCategory->id,
        'user_id' => $owner->id,
        'total_amount' => 15_000,
        'occurred_at' => now(),
    ]);
    Transaction::factory()->create([
        'sale_uuid' => $saleUuid,
        'tenant_id' => $tenant->id,
        'outlet_id' => $selectedOutlet->id,
        'shift_id' => $activeShift->id,
        'category_id' => $firstCategory->id,
        'user_id' => $owner->id,
        'total_amount' => 10_000,
        'occurred_at' => now(),
    ]);
    Transaction::factory()->create([
        'tenant_id' => $tenant->id,
        'outlet_id' => $firstOutlet->id,
        'user_id' => $owner->id,
        'total_amount' => 99_000,
        'occurred_at' => now(),
    ]);
    Debt::factory()->create([
        'tenant_id' => $tenant->id,
        'outlet_id' => $selectedOutlet->id,
        'amount' => 10_000,
        'paid_amount' => 3_000,
        'status' => DebtStatus::PartiallyPaid,
    ]);

    $this->actingAs($owner)
        ->get(route('cashier.index', ['outlet_id' => $selectedOutlet->id]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('cashier/index')
            ->has('outlets', 2)
            ->where('selectedOutlet.id', $selectedOutlet->id)
            ->where('activeShift.id', $activeShift->id)
            ->has('categories', 2)
            ->where('categories.0.id', $firstCategory->id)
            ->where('categories.1.id', $activeCategory->id)
            ->where('stats.total_sales', 25_000)
            ->where('stats.transaction_count', 1)
            ->where('stats.outstanding_debt_amount', 7_000)
            ->where('stats.outstanding_debt_count', 1)
            ->where('auth.roles', [OutletUserRole::Owner->value]),
        );
});

it('only exposes outlets assigned to a penjaga', function () {
    $tenant = Tenant::factory()->create();
    $penjaga = User::factory()->create(['tenant_id' => $tenant->id]);
    $penjaga->assignRole(OutletUserRole::Penjaga->value);
    $assignedOutlet = Outlet::factory()->create(['tenant_id' => $tenant->id]);
    $unassignedOutlet = Outlet::factory()->create(['tenant_id' => $tenant->id]);
    $penjaga->outlets()->attach($assignedOutlet, ['role' => OutletUserRole::Penjaga->value]);

    $this->actingAs($penjaga)
        ->get(route('cashier.index', ['outlet_id' => $unassignedOutlet->id]))
        ->assertInertia(fn (Assert $page) => $page
            ->has('outlets', 1)
            ->where('outlets.0.id', $assignedOutlet->id)
            ->where('selectedOutlet.id', $assignedOutlet->id),
        );
});

it('renders empty cashier props when the user has no accessible outlet', function () {
    $tenant = Tenant::factory()->create();
    $penjaga = User::factory()->create(['tenant_id' => $tenant->id]);
    $penjaga->assignRole(OutletUserRole::Penjaga->value);

    $this->actingAs($penjaga)
        ->get(route('cashier.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('cashier/index')
            ->has('outlets', 0)
            ->where('selectedOutlet', null)
            ->where('activeShift', null)
            ->has('categories', 0)
            ->where('stats.total_sales', 0)
            ->where('stats.transaction_count', 0)
            ->where('stats.outstanding_debt_amount', 0)
            ->where('stats.outstanding_debt_count', 0),
        );
});
