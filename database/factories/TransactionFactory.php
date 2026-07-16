<?php

namespace Database\Factories;

use App\Enums\InputMethod;
use App\Models\Category;
use App\Models\Outlet;
use App\Models\Shift;
use App\Models\Tenant;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Transaction>
 */
class TransactionFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $quantity = fake()->numberBetween(1, 5);
        $unitPrice = fake()->numberBetween(1, 30) * 1000;

        return [
            'client_uuid' => (string) Str::uuid7(),
            'tenant_id' => Tenant::factory(),
            'outlet_id' => Outlet::factory(),
            'shift_id' => Shift::factory(),
            'category_id' => Category::factory(),
            'user_id' => User::factory(),
            'barcode' => null,
            'quantity' => $quantity,
            'unit_price' => $unitPrice,
            'total_amount' => $quantity * $unitPrice,
            'input_method' => InputMethod::Manual,
            'note' => null,
            'occurred_at' => now()->subMinutes(fake()->numberBetween(1, 600)),
        ];
    }

    /**
     * Indicate that the transaction was captured via barcode scan.
     */
    public function scanned(): static
    {
        return $this->state(fn (array $attributes) => [
            'input_method' => InputMethod::Scan,
            'barcode' => fake()->ean13(),
        ]);
    }
}
