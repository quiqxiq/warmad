<?php

namespace Database\Factories;

use App\Models\Debt;
use App\Models\DebtPayment;
use App\Models\Outlet;
use App\Models\Shift;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<DebtPayment>
 */
class DebtPaymentFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'client_uuid' => (string) Str::uuid7(),
            'tenant_id' => Tenant::factory(),
            'outlet_id' => Outlet::factory(),
            'debt_id' => Debt::factory(),
            'shift_id' => Shift::factory(),
            'user_id' => User::factory(),
            'amount' => fake()->numberBetween(1, 100) * 1000,
            'paid_at' => now(),
        ];
    }

    public function forContext(Debt $debt, Shift $shift, User $user): static
    {
        return $this->state(fn (): array => [
            'tenant_id' => $debt->tenant_id,
            'outlet_id' => $debt->outlet_id,
            'debt_id' => $debt->id,
            'shift_id' => $shift->id,
            'user_id' => $user->id,
        ]);
    }
}
