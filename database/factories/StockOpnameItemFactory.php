<?php

namespace Database\Factories;

use App\Enums\InputMethod;
use App\Models\StockOpnameItem;
use App\Models\StockOpnameSession;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<StockOpnameItem>
 */
class StockOpnameItemFactory extends Factory
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
            'stock_opname_session_id' => StockOpnameSession::factory(),
            'section' => 'Rak '.fake()->numberBetween(1, 10),
            'name' => fake()->words(2, true),
            'barcode' => null,
            'quantity' => fake()->numberBetween(1, 48),
            'unit_price' => fake()->numberBetween(1, 30) * 1000,
            'input_method' => InputMethod::Manual,
            'photo_before_path' => null,
            'photo_after_path' => null,
            'dispute_note' => null,
            'counted_by' => User::factory(),
        ];
    }

    /**
     * Indicate that the item was captured via barcode scan.
     */
    public function scanned(): static
    {
        return $this->state(fn (array $attributes) => [
            'input_method' => InputMethod::Scan,
            'barcode' => fake()->ean13(),
        ]);
    }

    /**
     * Indicate that the item count is disputed by one party.
     */
    public function disputed(): static
    {
        return $this->state(fn (array $attributes) => [
            'dispute_note' => fake()->sentence(),
        ]);
    }
}
