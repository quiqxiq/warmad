<?php

use App\Enums\DebtStatus;
use App\Enums\OutletUserRole;
use App\Enums\ShiftStatus;
use App\Models\Debt;
use App\Models\DebtPayment;
use App\Models\Outlet;
use App\Models\Shift;
use App\Models\Tenant;
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
        'status' => ShiftStatus::Active,
        'started_at' => now()->subHour(),
    ]);
    $this->debt = Debt::factory()->create([
        'tenant_id' => $this->tenant->id,
        'outlet_id' => $this->outlet->id,
        'amount' => 10_000,
        'paid_amount' => 0,
        'status' => DebtStatus::Unpaid,
    ]);

    Sanctum::actingAs($this->user);
});

function debtPaymentPayload(int $shiftId, array $overrides = []): array
{
    return [
        'client_uuid' => (string) Str::uuid7(),
        'shift_id' => $shiftId,
        'amount' => 4_000,
        'paid_at' => now()->toIso8601String(),
        ...$overrides,
    ];
}

it('records append-only partial payments and updates the debt projection', function () {
    $payload = debtPaymentPayload($this->shift->id);

    $this->postJson(route('api.debts.payments.store', $this->debt), $payload)
        ->assertCreated()
        ->assertJsonPath('data.amount', 4_000)
        ->assertJsonPath('data.shift_id', $this->shift->id)
        ->assertJsonPath('debt.paid_amount', 4_000)
        ->assertJsonPath('debt.status', DebtStatus::PartiallyPaid->value);

    $payment = DebtPayment::query()->sole();

    expect($payment->tenant_id)->toBe($this->tenant->id)
        ->and($payment->outlet_id)->toBe($this->outlet->id)
        ->and($payment->user_id)->toBe($this->user->id);
});

it('returns an identical payment retry without incrementing the debt twice', function () {
    $payload = debtPaymentPayload($this->shift->id);

    $this->postJson(route('api.debts.payments.store', $this->debt), $payload)->assertCreated();
    $this->postJson(route('api.debts.payments.store', $this->debt), $payload)
        ->assertOk()
        ->assertJsonPath('debt.paid_amount', 4_000);

    expect(DebtPayment::query()->count())->toBe(1)
        ->and($this->debt->refresh()->paid_amount)->toBe(4_000);
});

it('settles a debt from multiple payments', function () {
    $this->postJson(route('api.debts.payments.store', $this->debt), debtPaymentPayload($this->shift->id))
        ->assertCreated();
    $this->postJson(route('api.debts.payments.store', $this->debt), debtPaymentPayload($this->shift->id, [
        'amount' => 6_000,
    ]))
        ->assertCreated()
        ->assertJsonPath('debt.paid_amount', 10_000)
        ->assertJsonPath('debt.status', DebtStatus::Paid->value)
        ->assertJsonPath('debt.paid_at', fn (mixed $paidAt): bool => is_string($paidAt));

    expect(DebtPayment::query()->count())->toBe(2);
});

it('rejects overpayment without changing the debt', function () {
    $this->postJson(route('api.debts.payments.store', $this->debt), debtPaymentPayload($this->shift->id, [
        'amount' => 10_001,
    ]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('amount');

    expect(DebtPayment::query()->count())->toBe(0)
        ->and($this->debt->refresh()->paid_amount)->toBe(0);
});

it('rejects payments assigned to a closed shift', function () {
    $this->shift->update([
        'status' => ShiftStatus::Closed,
        'ended_at' => now(),
    ]);

    $this->postJson(route('api.debts.payments.store', $this->debt), debtPaymentPayload($this->shift->id))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('shift_id');
});

it('does not expose mutable debt updates', function () {
    $this->patchJson(route('api.debts.show', $this->debt), [
        'paid_amount' => 4_000,
    ])->assertMethodNotAllowed();
});
