<?php

namespace App\Models;

use App\Enums\SubscriptionStatus;
use App\Enums\SubscriptionTier;
use Database\Factories\SubscriptionFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $tenant_id
 * @property SubscriptionTier $tier
 * @property SubscriptionStatus $status
 * @property string|null $xendit_id
 * @property Carbon|null $current_period_starts_at
 * @property Carbon|null $current_period_ends_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['tenant_id', 'tier', 'status', 'xendit_id', 'current_period_starts_at', 'current_period_ends_at'])]
class Subscription extends Model
{
    /** @use HasFactory<SubscriptionFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'tier' => SubscriptionTier::class,
            'status' => SubscriptionStatus::class,
            'current_period_starts_at' => 'datetime',
            'current_period_ends_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<Tenant, covariant $this>
     */
    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }
}
