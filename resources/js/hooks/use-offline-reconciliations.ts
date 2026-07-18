import { usePage } from '@inertiajs/react';
import { useMemo, useSyncExternalStore } from 'react';
import { getOfflineOwner } from '@/lib/offline-owner';
import { getOfflineReconciliationCoordinator } from '@/lib/offline-reconciliation-coordinator';

export function useOfflineReconciliations(shiftId?: number) {
    const { auth } = usePage().props;
    const owner = useMemo(() => getOfflineOwner(auth), [auth]);
    const coordinator = useMemo(
        () => getOfflineReconciliationCoordinator(owner),
        [owner],
    );
    const snapshot = useSyncExternalStore(
        coordinator.subscribe,
        coordinator.getSnapshot,
        coordinator.getSnapshot,
    );
    const reconciliations = useMemo(
        () =>
            snapshot.reconciliations.filter(
                (item) =>
                    shiftId === undefined ||
                    item.payload.shift_id === shiftId,
            ),
        [shiftId, snapshot.reconciliations],
    );

    return {
        reconciliations,
        pendingCount: reconciliations.length,
        status: snapshot.status,
        lastError: snapshot.lastError,
        storageError: snapshot.storageError,
        isOnline: snapshot.isOnline,
        submit: coordinator.submit.bind(coordinator),
        syncNow: coordinator.syncNow,
    };
}
