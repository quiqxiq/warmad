<?php

namespace App\Models\Concerns;

use App\Models\Tenant;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Scopes every query to the authenticated user's tenant and fills
 * `tenant_id` automatically on create. Core isolation layer for the
 * shared-schema multi-tenant setup (PRD §8.3).
 */
trait BelongsToTenant
{
    public static function bootBelongsToTenant(): void
    {
        static::addGlobalScope('tenant', function (Builder $builder) {
            $user = auth()->user();

            // Unauthenticated contexts (seeders, queued jobs, console) run
            // without a tenant scope by design.
            if ($user === null) {
                return;
            }

            // Fail closed: an authenticated user without a tenant must never
            // see another tenant's rows.
            if ($user->tenant_id === null) {
                $builder->whereRaw('1 = 0');

                return;
            }

            $builder->where($builder->qualifyColumn('tenant_id'), $user->tenant_id);
        });

        static::creating(function (Model $model) {
            if ($model->getAttribute('tenant_id') === null && auth()->user()?->tenant_id !== null) {
                $model->setAttribute('tenant_id', auth()->user()->tenant_id);
            }
        });
    }

    /**
     * @return BelongsTo<Tenant, covariant $this>
     */
    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }
}
