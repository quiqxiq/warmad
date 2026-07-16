<?php

use App\Enums\ReconciliationStatus;
use App\Models\Outlet;
use App\Models\Shift;
use App\Models\Tenant;
use App\Models\Transaction;
use App\Models\User;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    $this->tenant = Tenant::factory()->create();
    $this->user = User::factory()->create(['tenant_id' => $this->tenant->id]);
    $this->outlet = Outlet::factory()->create(['tenant_id' => $this->tenant->id]);
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
    ]);
});

it('auto-approves a reconciliation within tolerance', function () {
    Sanctum::actingAs($this->user);

    // expected = 100k opening + 50k transactions = 150k; actual 145k → diff -5k
    $this->postJson('/api/cash-reconciliations', [
        'shift_id' => $this->shift->id,
        'actual_cash' => 145_000,
    ])
        ->assertCreated()
        ->assertJsonPath('data.status', ReconciliationStatus::AutoApproved->value)
        ->assertJsonPath('data.difference', -5_000)
        ->assertJsonPath('data.expected_cash', 150_000);
});

it('requires a note when the difference exceeds tolerance', function () {
    Sanctum::actingAs($this->user);

    $this->postJson('/api/cash-reconciliations', [
        'shift_id' => $this->shift->id,
        'actual_cash' => 100_000,
    ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('note');
});

it('accepts a large difference when explained', function () {
    Sanctum::actingAs($this->user);

    $this->postJson('/api/cash-reconciliations', [
        'shift_id' => $this->shift->id,
        'actual_cash' => 100_000,
        'note' => 'Uang dipakai bayar listrik dulu, struk ada.',
    ])
        ->assertCreated()
        ->assertJsonPath('data.status', ReconciliationStatus::Explained->value);
});

it('rejects a second reconciliation for the same shift', function () {
    Sanctum::actingAs($this->user);

    $payload = ['shift_id' => $this->shift->id, 'actual_cash' => 150_000];

    $this->postJson('/api/cash-reconciliations', $payload)->assertCreated();
    $this->postJson('/api/cash-reconciliations', $payload)
        ->assertUnprocessable()
        ->assertJsonValidationErrors('shift_id');
});
