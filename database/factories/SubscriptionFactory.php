<?php

namespace Database\Factories;

use App\Enums\SubscriptionStatus;
use App\Enums\SubscriptionTier;
use App\Models\Subscription;
use App\Models\Tenant;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Subscription>
 */
class SubscriptionFactory extends Factory
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
            'tier' => SubscriptionTier::Free,
            'status' => SubscriptionStatus::Active,
            'xendit_id' => null,
            'current_period_starts_at' => null,
            'current_period_ends_at' => null,
        ];
    }

    /**
     * Indicate a paid standard-tier subscription.
     */
    public function standard(): static
    {
        return $this->state(fn (array $attributes) => [
            'tier' => SubscriptionTier::Standard,
            'current_period_starts_at' => now()->startOfMonth(),
            'current_period_ends_at' => now()->endOfMonth(),
        ]);
    }
}
