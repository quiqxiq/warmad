<?php

use App\Enums\OutletUserRole;
use App\Models\Category;
use App\Models\Debt;
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
    $this->shift = Shift::factory()->create([
        'tenant_id' => $this->tenant->id,
        'outlet_id' => $this->outlet->id,
        'user_id' => $this->user->id,
    ]);
    $this->categories = Category::factory()->count(2)->create([
        'tenant_id' => $this->tenant->id,
        'outlet_id' => $this->outlet->id,
    ]);

    Sanctum::actingAs($this->user);
});

function transactionBatchPayload(array $overrides = []): array
{
    return [
        'client_uuid' => (string) Str::uuid7(),
        'items' => [],
        'input_method' => 'voice',
        'occurred_at' => now()->toIso8601String(),
        ...$overrides,
    ];
}

it('stores a batch cash sale with aggregate payment by default', function () {
    $saleUuid = (string) Str::uuid7();
    $payload = transactionBatchPayload([
        'client_uuid' => $saleUuid,
        'outlet_id' => $this->outlet->id,
        'shift_id' => $this->shift->id,
        'items' => [
            ['category_id' => $this->categories[0]->id, 'quantity' => 2, 'unit_price' => 5_000],
            ['category_id' => $this->categories[1]->id, 'quantity' => 1, 'unit_price' => 7_000],
        ],
    ]);

    $this->postJson(route('api.transactions.batch-store'), $payload)
        ->assertCreated()
        ->assertJsonPath('data.sale_uuid', $saleUuid)
        ->assertJsonCount(2, 'data.items')
        ->assertJsonPath('data.items.0.payment_amount', 10_000)
        ->assertJsonPath('data.items.0.change_amount', 0)
        ->assertJsonPath('data.items.1.payment_amount', 7_000)
        ->assertJsonPath('data.items.1.change_amount', 0)
        ->assertJsonPath('data.total_amount', 17_000)
        ->assertJsonPath('data.payment_amount', 17_000)
        ->assertJsonPath('data.change_amount', 0)
        ->assertJsonPath('data.debt_amount', 0);

    expect(Transaction::where('sale_uuid', $saleUuid)->count())->toBe(2)
        ->and(Debt::count())->toBe(0);
});

it('creates exactly one aggregate debt for a partial batch payment', function () {
    $saleUuid = (string) Str::uuid7();
    $payload = transactionBatchPayload([
        'client_uuid' => $saleUuid,
        'outlet_id' => $this->outlet->id,
        'shift_id' => $this->shift->id,
        'items' => [
            ['category_id' => $this->categories[0]->id, 'quantity' => 1, 'unit_price' => 10_000],
            ['category_id' => $this->categories[1]->id, 'quantity' => 1, 'unit_price' => 7_000],
        ],
        'payment_amount' => 12_000,
        'customer_name' => 'Budi Setiawan',
    ]);

    $this->postJson(route('api.transactions.batch-store'), $payload)
        ->assertCreated()
        ->assertJsonPath('data.items.0.payment_amount', 10_000)
        ->assertJsonPath('data.items.1.payment_amount', 2_000)
        ->assertJsonPath('data.payment_amount', 12_000)
        ->assertJsonPath('data.debt_amount', 5_000);

    $debt = Debt::query()->sole();

    expect($debt->customer_name)->toBe('Budi Setiawan')
        ->and($debt->amount)->toBe(5_000)
        ->and(Transaction::where('sale_uuid', $saleUuid)->count())->toBe(2);
});

it('puts aggregate change on the final row for overpayment', function () {
    $saleUuid = (string) Str::uuid7();
    $payload = transactionBatchPayload([
        'client_uuid' => $saleUuid,
        'outlet_id' => $this->outlet->id,
        'shift_id' => $this->shift->id,
        'items' => [
            ['category_id' => $this->categories[0]->id, 'quantity' => 1, 'unit_price' => 10_000],
            ['category_id' => $this->categories[1]->id, 'quantity' => 1, 'unit_price' => 7_000],
        ],
        'payment_amount' => 20_000,
    ]);

    $this->postJson(route('api.transactions.batch-store'), $payload)
        ->assertCreated()
        ->assertJsonPath('data.items.0.payment_amount', 10_000)
        ->assertJsonPath('data.items.0.change_amount', 0)
        ->assertJsonPath('data.items.1.payment_amount', 7_000)
        ->assertJsonPath('data.items.1.change_amount', 3_000)
        ->assertJsonPath('data.payment_amount', 20_000)
        ->assertJsonPath('data.change_amount', 3_000)
        ->assertJsonPath('data.debt_amount', 0);
});

it('returns existing rows without duplicating transactions or debt on retry', function () {
    $saleUuid = (string) Str::uuid7();
    $payload = transactionBatchPayload([
        'client_uuid' => $saleUuid,
        'outlet_id' => $this->outlet->id,
        'shift_id' => $this->shift->id,
        'items' => [
            ['category_id' => $this->categories[0]->id, 'quantity' => 1, 'unit_price' => 10_000],
        ],
        'payment_amount' => 5_000,
        'customer_name' => 'Siti',
    ]);

    $this->postJson(route('api.transactions.batch-store'), $payload)->assertCreated();
    $this->postJson(route('api.transactions.batch-store'), $payload)
        ->assertOk()
        ->assertJsonPath('data.sale_uuid', $saleUuid)
        ->assertJsonPath('data.debt_amount', 5_000)
        ->assertJsonCount(1, 'data.items');

    expect(Transaction::where('sale_uuid', $saleUuid)->count())->toBe(1)
        ->and(Debt::count())->toBe(1);
});

it('requires a customer name when aggregate payment is below the total', function () {
    $payload = transactionBatchPayload([
        'outlet_id' => $this->outlet->id,
        'shift_id' => $this->shift->id,
        'items' => [
            ['category_id' => $this->categories[0]->id, 'quantity' => 2, 'unit_price' => 5_000],
        ],
        'payment_amount' => 9_000,
    ]);

    $this->postJson(route('api.transactions.batch-store'), $payload)
        ->assertUnprocessable()
        ->assertJsonValidationErrors('customer_name');
});

it('rejects shifts and categories from another outlet', function () {
    $otherOutlet = Outlet::factory()->create(['tenant_id' => $this->tenant->id]);
    $otherShift = Shift::factory()->create([
        'tenant_id' => $this->tenant->id,
        'outlet_id' => $otherOutlet->id,
        'user_id' => $this->user->id,
    ]);
    $otherCategory = Category::factory()->create([
        'tenant_id' => $this->tenant->id,
        'outlet_id' => $otherOutlet->id,
    ]);

    $payload = transactionBatchPayload([
        'outlet_id' => $this->outlet->id,
        'shift_id' => $otherShift->id,
        'items' => [
            ['category_id' => $otherCategory->id, 'quantity' => 1, 'unit_price' => 5_000],
        ],
    ]);

    $this->postJson(route('api.transactions.batch-store'), $payload)
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['shift_id', 'items.0.category_id']);
});

it('rejects an outlet from another tenant', function () {
    $otherTenant = Tenant::factory()->create();
    $otherOutlet = Outlet::factory()->create(['tenant_id' => $otherTenant->id]);
    $otherShift = Shift::factory()->create([
        'tenant_id' => $otherTenant->id,
        'outlet_id' => $otherOutlet->id,
        'user_id' => $this->user->id,
    ]);
    $otherCategory = Category::factory()->create([
        'tenant_id' => $otherTenant->id,
        'outlet_id' => $otherOutlet->id,
    ]);

    $payload = transactionBatchPayload([
        'outlet_id' => $otherOutlet->id,
        'shift_id' => $otherShift->id,
        'items' => [
            ['category_id' => $otherCategory->id, 'quantity' => 1, 'unit_price' => 5_000],
        ],
    ]);

    $this->postJson(route('api.transactions.batch-store'), $payload)
        ->assertUnprocessable()
        ->assertJsonValidationErrors('outlet_id');
});
