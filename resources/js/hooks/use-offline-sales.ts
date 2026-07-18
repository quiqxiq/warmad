import { usePage } from '@inertiajs/react';
import { useMemo, useSyncExternalStore } from 'react';
import { getOfflineOwner } from '@/lib/offline-owner';
import { getOfflineSalesCoordinator } from '@/lib/offline-sales-coordinator';

export function useOfflineSales(outletId?: number) {
    const { auth } = usePage().props;
    const owner = useMemo(() => getOfflineOwner(auth), [auth]);
    const coordinator = useMemo(
        () => getOfflineSalesCoordinator(owner),
        [owner],
    );
    const snapshot = useSyncExternalStore(
        coordinator.subscribe,
        coordinator.getSnapshot,
        coordinator.getSnapshot,
    );
    const sales = useMemo(
        () =>
            snapshot.sales.filter(
                (sale) =>
                    outletId === undefined ||
                    sale.payload.outlet_id === outletId,
            ),
        [outletId, snapshot.sales],
    );

    return {
        sales,
        transactions: sales,
        pendingCount: sales.length,
        status: snapshot.status,
        lastError: snapshot.lastError,
        storageError: snapshot.storageError,
        isOnline: snapshot.isOnline,
        enqueue: coordinator.enqueue.bind(coordinator),
        submit: coordinator.submit.bind(coordinator),
        syncNow: coordinator.syncNow,
        drainShift: coordinator.drainShift.bind(coordinator),
    };
}
