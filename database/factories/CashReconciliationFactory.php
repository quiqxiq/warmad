<?php

namespace Database\Factories;

use App\Enums\ReconciliationStatus;
use App\Models\CashReconciliation;
use App\Models\Outlet;
use App\Models\Shift;
use App\Models\Tenant;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<CashReconciliation>
 */
class CashReconciliationFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $expected = fake()->numberBetween(200, 2000) * 1000;
        $difference = fake()->numberBetween(-20, 20) * 1000;

        return [
            'tenant_id' => Tenant::factory(),
            'outlet_id' => Outlet::factory(),
            'shift_id' => Shift::factory(),
            'expected_cash' => $expected,
            'actual_cash' => $expected + $difference,
            'difference' => $difference,
            'status' => abs($difference) <= 10_000
                ? ReconciliationStatus::AutoApproved
                : ReconciliationStatus::NeedsExplanation,
            'note' => null,
            'reconciled_at' => now(),
        ];
    }

    /**
     * Indicate that the difference was within tolerance.
     */
    public function balanced(): static
    {
        return $this->state(fn (array $attributes) => [
            'actual_cash' => $attributes['expected_cash'],
            'difference' => 0,
            'status' => ReconciliationStatus::AutoApproved,
        ]);
    }
}
