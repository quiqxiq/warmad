<?php

use App\Models\Category;
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
    $this->outlet = Outlet::factory()->create(['tenant_id' => $this->tenant->id]);
    $this->shift = Shift::factory()->create([
        'tenant_id' => $this->tenant->id,
        'outlet_id' => $this->outlet->id,
        'user_id' => $this->user->id,
    ]);
    $this->category = Category::factory()->create([
        'tenant_id' => $this->tenant->id,
        'outlet_id' => $this->outlet->id,
    ]);

    Sanctum::actingAs($this->user);
});

function transactionPayload(array $overrides = []): array
{
    return [
        'client_uuid' => (string) Str::uuid7(),
        'quantity' => 2,
        'unit_price' => 5_000,
        'input_method' => 'manual',
        'occurred_at' => now()->toIso8601String(),
        ...$overrides,
    ];
}

it('records a transaction and computes the total', function () {
    $payload = transactionPayload([
        'outlet_id' => $this->outlet->id,
        'shift_id' => $this->shift->id,
        'category_id' => $this->category->id,
    ]);

    $this->postJson('/api/transactions', $payload)
        ->assertCreated()
        ->assertJsonPath('data.total_amount', 10_000);
});

it('is idempotent on client_uuid for offline retries', function () {
    $payload = transactionPayload([
        'outlet_id' => $this->outlet->id,
        'shift_id' => $this->shift->id,
        'category_id' => $this->category->id,
    ]);

    $this->postJson('/api/transactions', $payload)->assertCreated();
    $this->postJson('/api/transactions', $payload)->assertOk();

    expect(Transaction::count())->toBe(1);
});

it('validates the input method enum', function () {
    $payload = transactionPayload([
        'outlet_id' => $this->outlet->id,
        'shift_id' => $this->shift->id,
        'category_id' => $this->category->id,
        'input_method' => 'telepathy',
    ]);

    $this->postJson('/api/transactions', $payload)
        ->assertUnprocessable()
        ->assertJsonValidationErrors('input_method');
});
