import { storeBatch } from '@/actions/App/Http/Controllers/Api/TransactionController';
import {
    ApiError,
    apiRequest,
    getRequestErrorMessage,
    isNetworkError,
} from '@/lib/api';
import {
    claimPendingSale,
    closeOfflineDatabase,
    deletePendingSaleIfRevision,
    getPendingSale,
    getPendingSales,
    OFFLINE_DATABASE_EVENT,
    OFFLINE_DATABASE_STORES,
    putPendingSale,
    updatePendingSaleIfRevision
    
} from '@/lib/offline-database';
import type {OfflineStorageEventDetail} from '@/lib/offline-database';
import { isSameOfflineOwner, offlineOwnerKey } from '@/lib/offline-owner';
import type {
    BatchTransactionPayload,
    OfflineOwner,
    OfflineSaleSubmissionResult,
    OfflineSaleSyncStatus,
    PendingSale,
} from '@/types';

type CoordinatorSnapshot = {
    sales: PendingSale[];
    status: OfflineSaleSyncStatus;
    lastError: string | null;
    storageError: string | null;
    isOnline: boolean;
};

type DrainResult = {
    targetError?: unknown;
};

const initialSnapshot: CoordinatorSnapshot = {
    sales: [],
    status: 'synced',
    lastError: null,
    storageError: null,
    isOnline: typeof navigator === 'undefined' ? true : navigator.onLine,
};

function payloadMatches(
    left: BatchTransactionPayload,
    right: BatchTransactionPayload,
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

class OfflineSalesCoordinator {
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
        payload: BatchTransactionPayload,
    ): Promise<OfflineSaleSubmissionResult> {
        const pendingSale = await this.enqueue(payload);

        if (!this.snapshot.isOnline) {
            return 'queued';
        }

        const result = await this.drainQueue({
            includeFailed: true,
            targetClientUuid: pendingSale.clientUuid,
        });

        if (result.targetError && !isTransientError(result.targetError)) {
            throw result.targetError;
        }

        return (await getPendingSale(this.owner, pendingSale.clientUuid))
            ? 'queued'
            : 'sent';
    }

    public async enqueue(
        payload: BatchTransactionPayload,
    ): Promise<PendingSale> {
        const existingSale = await getPendingSale(
            this.owner,
            payload.client_uuid,
        );

        if (existingSale && !payloadMatches(existingSale.payload, payload)) {
            throw new Error(
                'UUID transaksi ini sudah dipakai untuk payload yang berbeda.',
            );
        }

        const now = new Date().toISOString();
        const pendingSale: PendingSale = {
            clientUuid: payload.client_uuid,
            revision: (existingSale?.revision ?? 0) + 1,
            payload,
            status: 'pending',
            attempts: existingSale?.attempts ?? 0,
            createdAt: existingSale?.createdAt ?? now,
            updatedAt: now,
        };

        await putPendingSale(this.owner, pendingSale);
        await this.refresh();

        return pendingSale;
    }

    public syncNow = async (): Promise<void> => {
        await this.drainQueue({ includeFailed: true });
    };

    public async drainShift(shiftId: number): Promise<boolean> {
        await this.drainQueue({ includeFailed: true });

        return !(await getPendingSales(this.owner)).some(
            (sale) => sale.payload.shift_id === shiftId,
        );
    }

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
            status: this.snapshot.sales.length > 0 ? 'offline' : 'synced',
        });
    };

    private handleStorageChange = (event: Event): void => {
        const detail = (event as CustomEvent<OfflineStorageEventDetail>).detail;

        if (
            detail?.store === OFFLINE_DATABASE_STORES.pendingSales &&
            isSameOfflineOwner(this.owner, detail)
        ) {
            void this.refresh();
        }
    };

    private async refresh(): Promise<void> {
        try {
            const sales = await getPendingSales(this.owner);
            const status = this.statusFor(sales);

            this.setSnapshot({ sales, status, storageError: null });
            this.scheduleRetry(sales);
        } catch (error) {
            this.setSnapshot({
                storageError: getRequestErrorMessage(error),
                status: 'error',
            });
        }
    }

    private statusFor(sales: PendingSale[]): OfflineSaleSyncStatus {
        if (!this.snapshot.isOnline && sales.length > 0) {
            return 'offline';
        }

        if (sales.some((sale) => sale.status === 'syncing')) {
            return 'syncing';
        }

        if (sales.some((sale) => sale.status === 'failed')) {
            return 'error';
        }

        return sales.length > 0 ? 'pending' : 'synced';
    }

    private setSnapshot(update: Partial<CoordinatorSnapshot>): void {
        this.snapshot = { ...this.snapshot, ...update };
        this.listeners.forEach((listener) => listener());
    }

    private scheduleRetry(sales: PendingSale[]): void {
        if (this.retryTimer !== null) {
            window.clearTimeout(this.retryTimer);
            this.retryTimer = null;
        }

        if (!this.snapshot.isOnline) {
            return;
        }

        const nextAttempt = sales
            .filter((sale) => sale.status === 'pending' && sale.nextAttemptAt)
            .map((sale) => new Date(sale.nextAttemptAt as string).getTime())
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
            const sales = await getPendingSales(this.owner);

            for (const sale of sales) {
                const isTarget = sale.clientUuid === options.targetClientUuid;
                const retryTime = sale.nextAttemptAt
                    ? new Date(sale.nextAttemptAt).getTime()
                    : 0;

                if (
                    (!options.includeFailed && sale.status === 'failed') ||
                    (!isTarget && retryTime > Date.now())
                ) {
                    continue;
                }

                const claimed = await claimPendingSale(
                    this.owner,
                    sale.clientUuid,
                    sale.revision,
                );

                if (!claimed) {
                    continue;
                }

                try {
                    await apiRequest(
                        storeBatch(),
                        claimed.payload,
                        this.abortController.signal,
                    );
                    await deletePendingSaleIfRevision(
                        this.owner,
                        claimed.clientUuid,
                        claimed.revision,
                    );
                } catch (error) {
                    const transient = isTransientError(error);
                    const message = getRequestErrorMessage(error);

                    await updatePendingSaleIfRevision(
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
            `amanah:offline-sales-sync:${offlineOwnerKey(this.owner)}`,
            { ifAvailable: true, mode: 'exclusive' },
            async (lock) => (lock ? task() : {}),
        );
    }
}

let activeCoordinator: OfflineSalesCoordinator | null = null;

export function getOfflineSalesCoordinator(
    owner: OfflineOwner,
): OfflineSalesCoordinator {
    if (
        !activeCoordinator ||
        !isSameOfflineOwner(activeCoordinator.owner, owner)
    ) {
        void activeCoordinator?.stop();
        activeCoordinator = new OfflineSalesCoordinator(owner);
    }

    return activeCoordinator;
}

export async function pauseOfflineSalesCoordinator(): Promise<void> {
    const coordinator = activeCoordinator;
    activeCoordinator = null;
    await coordinator?.stop(true);
}
