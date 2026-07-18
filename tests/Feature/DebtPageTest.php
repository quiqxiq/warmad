<?php

use App\Enums\DebtStatus;
use App\Enums\OutletUserRole;
use App\Models\Debt;
use App\Models\Outlet;
use App\Models\Tenant;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->withoutVite();
});

it('redirects guests from the debt page', function () {
    $this->get(route('debts.index'))->assertRedirect(route('login'));
});

it('renders latest debts of every status for the selected accessible outlet', function () {
    $tenant = Tenant::factory()->create();
    $owner = User::factory()->create(['tenant_id' => $tenant->id]);
    $owner->assignRole(OutletUserRole::Owner->value);
    $outlet = Outlet::factory()->create(['tenant_id' => $tenant->id]);
    $otherOutlet = Outlet::factory()->create(['tenant_id' => $tenant->id]);

    Debt::factory()->create([
        'tenant_id' => $tenant->id,
        'outlet_id' => $outlet->id,
        'customer_name' => 'Belum Bayar',
        'amount' => 10_000,
        'status' => DebtStatus::Unpaid,
        'incurred_at' => today()->subDays(2),
    ]);
    Debt::factory()->create([
        'tenant_id' => $tenant->id,
        'outlet_id' => $outlet->id,
        'customer_name' => 'Cicilan',
        'amount' => 10_000,
        'paid_amount' => 4_000,
        'status' => DebtStatus::PartiallyPaid,
        'incurred_at' => today()->subDay(),
    ]);
    Debt::factory()->paid()->create([
        'tenant_id' => $tenant->id,
        'outlet_id' => $outlet->id,
        'customer_name' => 'Lunas',
        'incurred_at' => today(),
    ]);
    Debt::factory()->create([
        'tenant_id' => $tenant->id,
        'outlet_id' => $otherOutlet->id,
    ]);

    $this->actingAs($owner)
        ->get(route('debts.index', ['outlet_id' => $outlet->id]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('debts/index')
            ->has('outlets', 2)
            ->where('selectedOutlet.id', $outlet->id)
            ->has('debts', 3)
            ->where('debts.0.customer_name', 'Lunas')
            ->where('debts.0.status', DebtStatus::Paid->value)
            ->where('debts.1.status', DebtStatus::PartiallyPaid->value)
            ->where('debts.2.status', DebtStatus::Unpaid->value)
            ->where('summary.outstanding_amount', 16_000)
            ->where('summary.unpaid_count', 1)
            ->where('summary.paid_count', 1),
        );
});

it('shows all accessible outlets and calculates summary beyond the capped list', function () {
    $tenant = Tenant::factory()->create();
    $owner = User::factory()->create(['tenant_id' => $tenant->id]);
    $owner->assignRole(OutletUserRole::Owner->value);
    $firstOutlet = Outlet::factory()->create(['tenant_id' => $tenant->id]);
    $secondOutlet = Outlet::factory()->create(['tenant_id' => $tenant->id]);

    Debt::factory()->count(101)->create([
        'tenant_id' => $tenant->id,
        'outlet_id' => $firstOutlet->id,
        'amount' => 100,
        'paid_amount' => 0,
        'status' => DebtStatus::Unpaid,
    ]);
    Debt::factory()->create([
        'tenant_id' => $tenant->id,
        'outlet_id' => $secondOutlet->id,
        'amount' => 100,
        'paid_amount' => 0,
        'status' => DebtStatus::Unpaid,
    ]);

    $this->actingAs($owner)
        ->get(route('debts.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('selectedOutlet', null)
            ->has('debts', 100)
            ->where('summary.outstanding_amount', 10_200)
            ->where('summary.unpaid_count', 102)
            ->where('summary.paid_count', 0),
        );
});
