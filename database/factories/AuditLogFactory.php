<?php

namespace Database\Factories;

use App\Models\AuditLog;
use App\Models\Tenant;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<AuditLog>
 */
class AuditLogFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * Defaults to auditing a transaction "created" event; override
     * `auditable_type`/`auditable_id` and `action` for other subjects.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'tenant_id' => Tenant::factory(),
            'user_id' => User::factory(),
            'auditable_type' => Transaction::class,
            'auditable_id' => Transaction::factory(),
            'action' => 'created',
            'old_values' => null,
            'new_values' => ['status' => 'completed'],
        ];
    }

    /**
     * Record an update action with before/after snapshots.
     *
     * @param  array<string, mixed>  $old
     * @param  array<string, mixed>  $new
     */
    public function updated(array $old, array $new): static
    {
        return $this->state(fn (array $attributes) => [
            'action' => 'updated',
            'old_values' => $old,
            'new_values' => $new,
        ]);
    }
}
