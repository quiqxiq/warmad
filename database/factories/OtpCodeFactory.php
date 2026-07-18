<?php

namespace Database\Factories;

use App\Models\OtpCode;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;

/**
 * @extends Factory<OtpCode>
 */
class OtpCodeFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * The plain code is exposed via the `plainCode` attribute on the factory
     * so tests can submit it; the persisted `code` column stores only the hash.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $plainCode = str_pad((string) fake()->numberBetween(0, 999_999), 6, '0', STR_PAD_LEFT);

        return [
            'phone' => '628'.fake()->unique()->numerify('##########'),
            'code' => Hash::make($plainCode),
            'attempts' => 0,
            'expires_at' => now()->addMinutes(5),
            'consumed_at' => null,
        ];
    }

    /**
     * Persist a known plain code so tests can verify against it.
     */
    public function withCode(string $plainCode): static
    {
        return $this->state(fn (array $attributes) => [
            'code' => Hash::make($plainCode),
        ]);
    }

    /**
     * Indicate the code has already expired.
     */
    public function expired(): static
    {
        return $this->state(fn (array $attributes) => [
            'expires_at' => now()->subMinute(),
        ]);
    }

    /**
     * Indicate the code has already been consumed.
     */
    public function consumed(): static
    {
        return $this->state(fn (array $attributes) => [
            'consumed_at' => now(),
        ]);
    }

    /**
     * Indicate the code is one failed attempt away from the lockout ceiling.
     */
    public function nearlyLocked(): static
    {
        return $this->state(fn (array $attributes) => [
            'attempts' => 4,
        ]);
    }
}
