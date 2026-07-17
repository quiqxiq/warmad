<?php

namespace App\Models\Concerns;

use App\Models\AuditLog;
use Illuminate\Database\Eloquent\Model;

trait Auditable
{
    public static function bootAuditable(): void
    {
        static::created(function (Model $model) {
            static::recordAuditLog($model, 'created', null, $model->getAttributes());
        });

        static::updated(function (Model $model) {
            $changes = $model->getChanges();

            // Exclude common timestamp updates if they are the only changes
            unset($changes['updated_at']);

            if (empty($changes)) {
                return;
            }

            $oldValues = [];
            foreach (array_keys($changes) as $key) {
                $oldValues[$key] = $model->getOriginal($key);
            }

            static::recordAuditLog($model, 'updated', $oldValues, $changes);
        });

        static::deleted(function (Model $model) {
            static::recordAuditLog($model, 'deleted', $model->getOriginal(), null);
        });
    }

    /**
     * @param  array<string, mixed>|null  $oldValues
     * @param  array<string, mixed>|null  $newValues
     */
    protected static function recordAuditLog(Model $model, string $action, ?array $oldValues, ?array $newValues): void
    {
        $tenantId = null;

        if (array_key_exists('tenant_id', $model->getAttributes())) {
            $tenantId = $model->getAttribute('tenant_id');
        } elseif (method_exists($model, 'session')) {
            $session = $model->getAttribute('session');
            if ($session instanceof Model) {
                $tenantId = $session->getAttribute('tenant_id');
            }
        }

        if ($tenantId === null) {
            $tenantId = auth()->user()?->tenant_id;
        }

        $userId = auth()->user()?->id;

        AuditLog::create([
            'tenant_id' => $tenantId,
            'user_id' => $userId,
            'auditable_type' => $model->getMorphClass(),
            'auditable_id' => $model->getKey(),
            'action' => $action,
            'old_values' => $oldValues,
            'new_values' => $newValues,
        ]);
    }
}
