<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Support\Carbon;

/**
 * Append-only audit trail (PRD §10 auditability). Rows must never be
 * updated or deleted — only inserted.
 *
 * @property int $id
 * @property int|null $tenant_id
 * @property int|null $user_id
 * @property string $auditable_type
 * @property int $auditable_id
 * @property string $action
 * @property array<string, mixed>|null $old_values
 * @property array<string, mixed>|null $new_values
 * @property Carbon $created_at
 */
#[Fillable(['tenant_id', 'user_id', 'auditable_type', 'auditable_id', 'action', 'old_values', 'new_values'])]
class AuditLog extends Model
{
    public const UPDATED_AT = null;

    public $timestamps = false;

    protected static function booted(): void
    {
        static::updating(function () {
            throw new \Exception('Audit logs are append-only.');
        });

        static::deleting(function () {
            throw new \Exception('Audit logs are append-only.');
        });
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'old_values' => 'array',
            'new_values' => 'array',
            'created_at' => 'datetime',
        ];
    }

    /**
     * @return MorphTo<Model, covariant $this>
     */
    public function auditable(): MorphTo
    {
        return $this->morphTo();
    }

    /**
     * @return BelongsTo<User, covariant $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
