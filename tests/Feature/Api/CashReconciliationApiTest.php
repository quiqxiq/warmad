<?php

use App\Enums\DebtStatus;
use App\Enums\OutletUserRole;
use App\Enums\ReconciliationStatus;
use App\Enums\ShiftStatus;
use App\Models\Debt;
use App\Models\DebtPayment;
use App\Models\Outlet;
use App\Models\Shift;
use App\Models\Tenant;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    $this->tenant = Tenant::factory()->create();
    $this->user = User::factory()->create(['tenant_id' => $this->tenant->id]);
    $this->user->assignRole(OutletUserRole::Owner->value);
    $this->outlet = Outlet::factory()->create(['tenant_id' => $this->tenant->id]);
    $this->clientUuid = (string) Str::uuid7();
    $this->shift = Shift::factory()->create([
        'tenant_id' => $this->tenant->id,
        'outlet_id' => $this->outlet->id,
        'user_id' => $this->user->id,
        'opening_cash' => 100_000,
    ]);

    Transaction::factory()->create([
        'tenant_id' => $this->tenant->id,
        'outlet_id' => $this->outlet->id,
        'shift_id' => $this->shift->id,
        'user_id' => $this->user->id,
        'quantity' => 1,
        'unit_price' => 50_000,
        'total_amount' => 50_000,
        'payment_amount' => 60_000,
        'change_amount' => 10_000,
    ]);
});

it('auto-approves a reconciliation within tolerance', function () {
    Sanctum::actingAs($this->user);

    // The customer tendered 60k for a 50k sale, so only 50k remains in the register.
    // expected = 100k opening + 50k retained = 150k; actual 145k → diff -5k
    $this->postJson('/api/cash-reconciliations', [
        'client_uuid' => $this->clientUuid,
        'shift_id' => $this->shift->id,
        'actual_cash' => 145_000,
    ])
        ->assertCreated()
        ->assertJsonPath('data.status', ReconciliationStatus::AutoApproved->value)
        ->assertJsonPath('data.difference', -5_000)
        ->assertJsonPath('data.expected_cash', 150_000);

    expect($this->shift->refresh()->status)->toBe(ShiftStatus::Closed)
        ->and($this->shift->ended_at)->not->toBeNull();
});

it('does not count returned change as expected cash', function () {
    Sanctum::actingAs($this->user);

    $this->postJson('/api/cash-reconciliations', [
        'client_uuid' => $this->clientUuid,
        'shift_id' => $this->shift->id,
        'actual_cash' => 150_000,
    ])
        ->assertCreated()
        ->assertJsonPath('data.expected_cash', 150_000)
        ->assertJsonPath('data.difference', 0);
});

it('requires a note when the difference exceeds tolerance', function () {
    Sanctum::actingAs($this->user);

    $this->postJson('/api/cash-reconciliations', [
        'client_uuid' => $this->clientUuid,
        'shift_id' => $this->shift->id,
        'actual_cash' => 100_000,
    ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('note');
});

it('accepts a large difference when explained', function () {
    Sanctum::actingAs($this->user);

    $this->postJson('/api/cash-reconciliations', [
        'client_uuid' => $this->clientUuid,
        'shift_id' => $this->shift->id,
        'actual_cash' => 100_000,
        'note' => 'Uang dipakai bayar listrik dulu, struk ada.',
    ])
        ->assertCreated()
        ->assertJsonPath('data.status', ReconciliationStatus::Explained->value);
});

it('returns the existing reconciliation for an identical retry', function () {
    Sanctum::actingAs($this->user);

    $payload = [
        'client_uuid' => $this->clientUuid,
        'shift_id' => $this->shift->id,
        'actual_cash' => 150_000,
    ];

    $this->postJson('/api/cash-reconciliations', $payload)->assertCreated();
    $this->postJson('/api/cash-reconciliations', $payload)
        ->assertOk()
        ->assertJsonPath('data.client_uuid', $this->clientUuid);
});

it('includes debt cash payments received during the shift', function () {
    $debt = Debt::factory()->create([
        'tenant_id' => $this->tenant->id,
        'outlet_id' => $this->outlet->id,
        'amount' => 25_000,
        'paid_amount' => 25_000,
        'status' => DebtStatus::Paid,
        'paid_at' => now(),
    ]);
    DebtPayment::factory()
        ->forContext($debt, $this->shift, $this->user)
        ->create(['amount' => 25_000]);

    Sanctum::actingAs($this->user);

    $this->postJson('/api/cash-reconciliations', [
        'client_uuid' => $this->clientUuid,
        'shift_id' => $this->shift->id,
        'actual_cash' => 175_000,
    ])
        ->assertCreated()
        ->assertJsonPath('data.expected_cash', 175_000)
        ->assertJsonPath('data.difference', 0);
});
