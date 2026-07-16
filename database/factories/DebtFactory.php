<?php

namespace Database\Factories;

use App\Enums\DebtStatus;
use App\Models\Debt;
use App\Models\Outlet;
use App\Models\Tenant;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Debt>
 */
class DebtFactory extends Factory
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
            'customer_name' => fake()->firstName(),
            'amount' => fake()->numberBetween(5, 200) * 1000,
            'paid_amount' => 0,
            'status' => DebtStatus::Unpaid,
            'incurred_at' => fake()->dateTimeBetween('-30 days'),
            'paid_at' => null,
            'note' => null,
        ];
    }

    /**
     * Indicate that the debt has been fully paid.
     */
    public function paid(): static
    {
        return $this->state(fn (array $attributes) => [
            'paid_amount' => $attributes['amount'],
            'status' => DebtStatus::Paid,
            'paid_at' => now(),
        ]);
    }
}
