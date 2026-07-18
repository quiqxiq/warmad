import { store as storeReconciliation } from '@/actions/App/Http/Controllers/Api/CashReconciliationController';
import {
    ApiError,
    apiRequest,
    getRequestErrorMessage,
    isNetworkError,
} from '@/lib/api';
import {
    claimPendingReconciliation,
    closeOfflineDatabase,
    deletePendingReconciliationIfRevision,
    getPendingReconciliation,
    getPendingReconciliations,
    OFFLINE_DATABASE_EVENT,
    OFFLINE_DATABASE_STORES,
    putPendingReconciliation,
    updatePendingReconciliationIfRevision,
} from '@/lib/offline-database';
import type { OfflineStorageEventDetail } from '@/lib/offline-database';
import { isSameOfflineOwner, offlineOwnerKey } from '@/lib/offline-owner';
import { getOfflineSalesCoordinator } from '@/lib/offline-sales-coordinator';
import type {
    OfflineOwner,
    OfflineSaleSubmissionResult,
    OfflineSaleSyncStatus,
    PendingReconciliation,
    ReconciliationPayload,
} from '@/types';

type CoordinatorSnapshot = {
    reconciliations: PendingReconciliation[];
    status: OfflineSaleSyncStatus;
    lastError: string | null;
    storageError: string | null;
    isOnline: boolean;
};

type DrainResult = {
    targetError?: unknown;
};

const initialSnapshot: CoordinatorSnapshot = {
    reconciliations: [],
    status: 'synced',
    lastError: null,
    storageError: null,
    isOnline: typeof navigator === 'undefined' ? true : navigator.onLine,
};

function payloadMatches(
    left: ReconciliationPayload,
    right: ReconciliationPayload,
): boolean {
    return JSON.stringify(left) === JSON.stringify(right);
}

function isTransientError(error: unknown): boolean {
    return (
        isNetworkError(error) ||
        (error instanceof ApiError && [408, 425, 429].includes(error.status)) ||
        (error instanceof ApiError && error.status >= 500)
    );
}

function nextRetryAt(attempts: number): string {
    const delay = Math.min(60_000, 1000 * 2 ** Math.min(attempts, 6));

    return new Date(Date.now() + delay).toISOString();
}

/**
 * A shift close is only safe once every sale captured during that shift has
 * reached the server: the backend computes expected cash from persisted
 * transactions and refuses sales against a closed shift. This coordinator
 * therefore drains the shift's pending sales before letting its reconciliation
 * through, and never abandons a queued close — it survives reloads and retries
 * with backoff just like the sales queue.
 */
class OfflineReconciliationCoordinator {
    private snapshot: CoordinatorSnapshot = initialSnapshot;
    private readonly listeners = new Set<() => void>();
    private started = false;
    private syncPromise: Promise<DrainResult> | null = null;
    private retryTimer: number | null = null;
    private readonly abortController = new AbortController();

    public constructor(public readonly owner: OfflineOwner) {}

    public subscribe = (listener: () => void): (() => void) => {
        this.listeners.add(listener);
        this.start();

        return () => {
            this.listeners.delete(listener);
        };
    };

    public getSnapshot = (): CoordinatorSnapshot => this.snapshot;

    public async submit(
        payload: ReconciliationPayload,
        outletId?: number,
    ): Promise<OfflineSaleSubmissionResult> {
        const pending = await this.enqueue(payload, outletId);

        if (!this.snapshot.isOnline) {
            return 'queued';
        }

        const result = await this.drainQueue({
            includeFailed: true,
            targetClientUuid: pending.clientUuid,
        });

        if (result.targetError && !isTransientError(result.targetError)) {
            throw result.targetError;
        }

        return (await getPendingReconciliation(this.owner, pending.clientUuid))
            ? 'queued'
            : 'sent';
    }

    public async enqueue(
        payload: ReconciliationPayload,
        outletId?: number,
    ): Promise<PendingReconciliation> {
        const existing = await getPendingReconciliation(
            this.owner,
            payload.client_uuid,
        );

        if (existing && !payloadMatches(existing.payload, payload)) {
            throw new Error(
                'UUID tutup kas ini sudah dipakai untuk data yang berbeda.',
            );
        }

        const now = new Date().toISOString();
        const pending: PendingReconciliation = {
            clientUuid: payload.client_uuid,
            revision: (existing?.revision ?? 0) + 1,
            outletId: outletId ?? existing?.outletId ?? 0,
            payload,
            status: 'pending',
            attempts: existing?.attempts ?? 0,
            createdAt: existing?.createdAt ?? now,
            updatedAt: now,
        };

        await putPendingReconciliation(this.owner, pending);
        await this.refresh();

        return pending;
    }

    public syncNow = async (): Promise<void> => {
        await this.drainQueue({ includeFailed: true });
    };

    public async stop(closeDatabase = false): Promise<void> {
        this.abortController.abort();

        if (this.started) {
            window.removeEventListener('online', this.handleOnline);
            window.removeEventListener('offline', this.handleOffline);
            window.removeEventListener(
                OFFLINE_DATABASE_EVENT,
                this.handleStorageChange,
            );
        }

        if (this.retryTimer !== null) {
            window.clearTimeout(this.retryTimer);
            this.retryTimer = null;
        }

        this.started = false;
        this.listeners.clear();

        if (closeDatabase) {
            await closeOfflineDatabase();
        }
    }

    private start(): void {
        if (this.started || typeof window === 'undefined') {
            return;
        }

        this.started = true;
        window.addEventListener('online', this.handleOnline);
        window.addEventListener('offline', this.handleOffline);
        window.addEventListener(
            OFFLINE_DATABASE_EVENT,
            this.handleStorageChange,
        );
        void this.refresh().then(() => {
            if (this.snapshot.isOnline) {
                void this.drainQueue({ includeFailed: false });
            }
        });
    }

    private handleOnline = (): void => {
        this.setSnapshot({ isOnline: true });
        void this.drainQueue({ includeFailed: false });
    };

    private handleOffline = (): void => {
        this.setSnapshot({
            isOnline: false,
            status:
                this.snapshot.reconciliations.length > 0 ? 'offline' : 'synced',
        });
    };

    private handleStorageChange = (event: Event): void => {
        const detail = (event as CustomEvent<OfflineStorageEventDetail>).detail;

        if (
            detail?.store ===
                OFFLINE_DATABASE_STORES.pendingReconciliations &&
            isSameOfflineOwner(this.owner, detail)
        ) {
            void this.refresh();
        }
    };

    private async refresh(): Promise<void> {
        try {
            const reconciliations = await getPendingReconciliations(this.owner);
            const status = this.statusFor(reconciliations);

            this.setSnapshot({ reconciliations, status, storageError: null });
            this.scheduleRetry(reconciliations);
        } catch (error) {
            this.setSnapshot({
                storageError: getRequestErrorMessage(error),
                status: 'error',
            });
        }
    }

    private statusFor(
        reconciliations: PendingReconciliation[],
    ): OfflineSaleSyncStatus {
        if (!this.snapshot.isOnline && reconciliations.length > 0) {
            return 'offline';
        }

        if (reconciliations.some((item) => item.status === 'syncing')) {
            return 'syncing';
        }

        if (reconciliations.some((item) => item.status === 'failed')) {
            return 'error';
        }

        return reconciliations.length > 0 ? 'pending' : 'synced';
    }

    private setSnapshot(update: Partial<CoordinatorSnapshot>): void {
        this.snapshot = { ...this.snapshot, ...update };
        this.listeners.forEach((listener) => listener());
    }

    private scheduleRetry(reconciliations: PendingReconciliation[]): void {
        if (this.retryTimer !== null) {
            window.clearTimeout(this.retryTimer);
            this.retryTimer = null;
        }

        if (!this.snapshot.isOnline) {
            return;
        }

        const nextAttempt = reconciliations
            .filter((item) => item.status === 'pending' && item.nextAttemptAt)
            .map((item) => new Date(item.nextAttemptAt as string).getTime())
            .sort((left, right) => left - right)[0];

        if (nextAttempt === undefined) {
            return;
        }

        this.retryTimer = window.setTimeout(
            () => {
                this.retryTimer = null;
                void this.drainQueue({ includeFailed: false });
            },
            Math.max(0, nextAttempt - Date.now()),
        );
    }

    private async drainQueue(options: {
        includeFailed: boolean;
        targetClientUuid?: string;
    }): Promise<DrainResult> {
        if (!this.snapshot.isOnline) {
            return {};
        }

        if (this.syncPromise) {
            return this.syncPromise;
        }

        this.syncPromise = this.withCrossTabLock(async () => {
            this.setSnapshot({ status: 'syncing', lastError: null });
            const result: DrainResult = {};
            const reconciliations = await getPendingReconciliations(this.owner);
            const salesCoordinator = getOfflineSalesCoordinator(this.owner);

            for (const reconciliation of reconciliations) {
                const isTarget =
                    reconciliation.clientUuid === options.targetClientUuid;
                const retryTime = reconciliation.nextAttemptAt
                    ? new Date(reconciliation.nextAttemptAt).getTime()
                    : 0;

                if (
                    (!options.includeFailed &&
                        reconciliation.status === 'failed') ||
                    (!isTarget && retryTime > Date.now())
                ) {
                    continue;
                }

                // The register can only close after every sale from this shift
                // has synced. If any remain, defer the close and retry later
                // rather than closing on stale expected cash.
                const drained = await salesCoordinator.drainShift(
                    reconciliation.payload.shift_id,
                );

                if (!drained) {
                    // Not an error the cashier must act on — the close stays
                    // queued and syncs itself once the shift's sales land, so
                    // `submit` reports 'queued' rather than throwing.
                    await updatePendingReconciliationIfRevision(
                        this.owner,
                        reconciliation.clientUuid,
                        reconciliation.revision,
                        (current) => ({
                            ...current,
                            revision: current.revision + 1,
                            status: 'pending',
                            nextAttemptAt: nextRetryAt(current.attempts),
                            lastError:
                                'Menunggu transaksi shift ini selesai tersinkron.',
                            updatedAt: new Date().toISOString(),
                        }),
                    );

                    continue;
                }

                const claimed = await claimPendingReconciliation(
                    this.owner,
                    reconciliation.clientUuid,
                    reconciliation.revision,
                );

                if (!claimed) {
                    continue;
                }

                try {
                    await apiRequest(
                        storeReconciliation(),
                        claimed.payload,
                        this.abortController.signal,
                    );
                    await deletePendingReconciliationIfRevision(
                        this.owner,
                        claimed.clientUuid,
                        claimed.revision,
                    );
                } catch (error) {
                    const transient = isTransientError(error);
                    const message = getRequestErrorMessage(error);

                    await updatePendingReconciliationIfRevision(
                        this.owner,
                        claimed.clientUuid,
                        claimed.revision,
                        (current) => ({
                            ...current,
                            revision: current.revision + 1,
                            status: transient ? 'pending' : 'failed',
                            nextAttemptAt: transient
                                ? nextRetryAt(current.attempts)
                                : undefined,
                            lastError: message,
                            updatedAt: new Date().toISOString(),
                        }),
                    );
                    this.setSnapshot({ lastError: message });

                    if (isTarget) {
                        result.targetError = error;
                    }

                    if (isNetworkError(error)) {
                        break;
                    }
                }
            }

            return result;
        }).finally(async () => {
            this.syncPromise = null;
            await this.refresh();
        });

        return this.syncPromise;
    }

    private async withCrossTabLock(
        task: () => Promise<DrainResult>,
    ): Promise<DrainResult> {
        if (typeof navigator === 'undefined' || !navigator.locks) {
            return task();
        }

        return navigator.locks.request(
            `amanah:offline-reconciliation-sync:${offlineOwnerKey(this.owner)}`,
            { ifAvailable: true, mode: 'exclusive' },
            async (lock) => (lock ? task() : {}),
        );
    }
}

let activeCoordinator: OfflineReconciliationCoordinator | null = null;

export function getOfflineReconciliationCoordinator(
    owner: OfflineOwner,
): OfflineReconciliationCoordinator {
    if (
        !activeCoordinator ||
        !isSameOfflineOwner(activeCoordinator.owner, owner)
    ) {
        void activeCoordinator?.stop();
        activeCoordinator = new OfflineReconciliationCoordinator(owner);
    }

    return activeCoordinator;
}

export async function pauseOfflineReconciliationCoordinator(): Promise<void> {
    const coordinator = activeCoordinator;
    activeCoordinator = null;
    await coordinator?.stop(true);
}
