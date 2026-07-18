import {
    Cloud,
    CloudOff,
    LoaderCircle,
    RefreshCw,
    WifiOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { OfflineSaleSyncStatus } from '@/types';

type SyncStatusProps = {
    isOnline: boolean;
    pendingCount: number;
    status: OfflineSaleSyncStatus;
    onSync: () => void;
    compact?: boolean;
};

const statusLabels: Record<OfflineSaleSyncStatus, string> = {
    synced: 'Tersinkron',
    pending: 'Menunggu sinkron',
    syncing: 'Menyinkronkan',
    offline: 'Tersimpan offline',
    error: 'Perlu dicoba lagi',
};

export function SyncStatus({
    isOnline,
    pendingCount,
    status,
    onSync,
    compact = false,
}: SyncStatusProps) {
    const Icon =
        status === 'syncing'
            ? LoaderCircle
            : !isOnline
              ? WifiOff
              : pendingCount > 0
                ? CloudOff
                : Cloud;

    return (
        <Button
            type="button"
            variant="ghost"
            className={`min-h-12 rounded-xl px-3 text-xs ${
                pendingCount > 0 || !isOnline
                    ? 'text-amber-800 dark:text-amber-200'
                    : 'text-emerald-800 dark:text-emerald-200'
            }`}
            onClick={onSync}
            disabled={!isOnline || status === 'syncing' || pendingCount === 0}
            title={statusLabels[status]}
        >
            <Icon className={status === 'syncing' ? 'animate-spin' : ''} />
            <span className={compact ? 'hidden min-[390px]:inline' : ''}>
                {statusLabels[status]}
            </span>
            {pendingCount > 0 && (
                <span className="rounded-full bg-amber-200 px-1.5 py-0.5 text-[10px] font-bold text-amber-950 dark:bg-amber-800 dark:text-amber-50">
                    {pendingCount}
                </span>
            )}
            {pendingCount > 0 && status !== 'syncing' && isOnline && (
                <RefreshCw className="size-3.5" />
            )}
        </Button>
    );
}
