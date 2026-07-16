<?php

namespace Database\Factories;

use App\Enums\ShiftStatus;
use App\Models\Outlet;
use App\Models\Shift;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Shift>
 */
class ShiftFactory extends Factory
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
            'user_id' => User::factory(),
            'status' => ShiftStatus::Active,
            'opening_cash' => fake()->numberBetween(100_000, 1_000_000),
            'started_at' => now()->subHours(fake()->numberBetween(1, 12)),
            'ended_at' => null,
        ];
    }

    /**
     * Indicate that the shift has been closed.
     */
    public function closed(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => ShiftStatus::Closed,
            'ended_at' => now(),
        ]);
    }
}
