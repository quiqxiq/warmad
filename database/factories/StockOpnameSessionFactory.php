<?php

namespace Database\Factories;

use App\Enums\OpnameSessionStatus;
use App\Enums\OpnameSessionType;
use App\Models\Outlet;
use App\Models\StockOpnameSession;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<StockOpnameSession>
 */
class StockOpnameSessionFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'tenant_id' => Tenant::factory(),
            'outlet_id' => Outlet::factory(),
            'type' => OpnameSessionType::Initial,
            'status' => OpnameSessionStatus::Draft,
            'outgoing_user_id' => null,
            'incoming_user_id' => User::factory(),
            'total_value' => null,
            'note' => null,
        ];
    }

    /**
     * Indicate a handover session between two penjagas.
     */
    public function handover(): static
    {
        return $this->state(fn (array $attributes) => [
            'type' => OpnameSessionType::Handover,
            'outgoing_user_id' => User::factory(),
        ]);
    }

    /**
     * Indicate that both parties confirmed and the session is final.
     */
    public function finalized(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => OpnameSessionStatus::Final,
            'outgoing_confirmed_at' => now(),
            'incoming_confirmed_at' => now(),
            'total_value' => fake()->numberBetween(5_000, 50_000) * 1000,
            'finalized_at' => now(),
        ]);
    }
}
