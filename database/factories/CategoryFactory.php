<?php

namespace Database\Factories;

use App\Models\Category;
use App\Models\Outlet;
use App\Models\Tenant;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Category>
 */
class CategoryFactory extends Factory
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
            'name' => fake()->unique()->words(2, true),
            'default_price' => fake()->numberBetween(1, 50) * 1000,
            'icon' => null,
            'position' => fake()->numberBetween(0, 40),
            'is_active' => true,
        ];
    }
}
