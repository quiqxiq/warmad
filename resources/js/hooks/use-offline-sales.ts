import { useCallback, useEffect, useRef, useState } from 'react';
import { storeBatch } from '@/actions/App/Http/Controllers/Api/TransactionController';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { apiRequest, getRequestErrorMessage, isNetworkError } from '@/lib/api';
import {
    deletePendingSale,
    getPendingSale,
    getPendingSales,
    OFFLINE_DATABASE_EVENT,
    OFFLINE_DATABASE_STORES,
    putPendingSale,
} from '@/lib/offline-database';
import type {
    BatchTransactionPayload,
    OfflineSaleSubmissionResult,
    OfflineSaleSyncStatus,
    PendingSale,
} from '@/types';

const inFlightRequests = new Map<string, Promise<void>>();

function sendBatch(payload: BatchTransactionPayload): Promise<void> {
    const existingRequest = inFlightRequests.get(payload.client_uuid);

    if (existingRequest) {
        return existingRequest;
    }

    const request = apiRequest(storeBatch(), payload)
        .then(() => undefined)
        .finally(() => {
            inFlightRequests.delete(payload.client_uuid);
        });

    inFlightRequests.set(payload.client_uuid, request);

    return request;
}

export function useOfflineSales(outletId?: number) {
    const { isOnline } = useNetworkStatus();
    const [sales, setSales] = useState<PendingSale[]>([]);
    const [status, setStatus] = useState<OfflineSaleSyncStatus>('synced');
    const [lastError, setLastError] = useState<string | null>(null);
    const [storageError, setStorageError] = useState<string | null>(null);
    const syncingRef = useRef(false);

    const refresh = useCallback(async () => {
        try {
            const storedSales = await getPendingSales(outletId);
            setSales(storedSales);
            setStorageError(null);

            if (!isOnline && storedSales.length > 0) {
                setStatus('offline');
            } else if (storedSales.some((sale) => sale.status === 'failed')) {
                setStatus('error');
            } else if (storedSales.length > 0) {
                setStatus('pending');
            } else {
                setStatus('synced');
            }
        } catch (error) {
            const message = getRequestErrorMessage(error);
            setStorageError(message);
            setStatus('error');
        }
    }, [isOnline, outletId]);

    useEffect(() => {
        const initialRefresh = window.setTimeout(() => void refresh(), 0);

        const handleStorageChange = (event: Event) => {
            const detail = (event as CustomEvent<{ store?: string }>).detail;

            if (
                !detail?.store ||
                detail.store === OFFLINE_DATABASE_STORES.pendingSales
            ) {
                void refresh();
            }
        };

        window.addEventListener(OFFLINE_DATABASE_EVENT, handleStorageChange);

        return () => {
            window.clearTimeout(initialRefresh);
            window.removeEventListener(
                OFFLINE_DATABASE_EVENT,
                handleStorageChange,
            );
        };
    }, [refresh]);

    const enqueue = useCallback(
        async (payload: BatchTransactionPayload): Promise<PendingSale> => {
            const now = new Date().toISOString();
            const existingSale = await getPendingSale(payload.client_uuid);
            const pendingSale: PendingSale = {
                clientUuid: payload.client_uuid,
                payload,
                status: 'pending',
                attempts: existingSale?.attempts ?? 0,
                createdAt: existingSale?.createdAt ?? now,
                updatedAt: now,
            };

            await putPendingSale(pendingSale);
            await refresh();

            return pendingSale;
        },
        [refresh],
    );

    const syncNow = useCallback(async () => {
        if (!isOnline || syncingRef.current) {
            return;
        }

        syncingRef.current = true;
        setStatus('syncing');
        setLastError(null);

        try {
            const pendingSales = await getPendingSales(outletId);
            let hasRequestError = false;

            for (const sale of pendingSales) {
                const syncingSale: PendingSale = {
                    ...sale,
                    status: 'syncing',
                    attempts: sale.attempts + 1,
                    updatedAt: new Date().toISOString(),
                    lastError: undefined,
                };

                await putPendingSale(syncingSale);

                try {
                    await sendBatch(sale.payload);
                    await deletePendingSale(sale.clientUuid);
                } catch (error) {
                    const message = getRequestErrorMessage(error);
                    const networkFailure = isNetworkError(error);

                    await putPendingSale({
                        ...syncingSale,
                        status: networkFailure ? 'pending' : 'failed',
                        lastError: message,
                        updatedAt: new Date().toISOString(),
                    });
                    setLastError(message);
                    hasRequestError = true;

                    if (networkFailure) {
                        break;
                    }
                }
            }

            await refresh();

            if (hasRequestError) {
                setStatus(navigator.onLine ? 'error' : 'offline');
            }
        } catch (error) {
            setLastError(getRequestErrorMessage(error));
            setStatus('error');
        } finally {
            syncingRef.current = false;
        }
    }, [isOnline, outletId, refresh]);

    const submit = useCallback(
        async (
            payload: BatchTransactionPayload,
        ): Promise<OfflineSaleSubmissionResult> => {
            if (!isOnline) {
                await enqueue(payload);

                return 'queued';
            }

            try {
                await sendBatch(payload);

                return 'sent';
            } catch (error) {
                if (!isNetworkError(error)) {
                    throw error;
                }

                await enqueue(payload);

                return 'queued';
            }
        },
        [enqueue, isOnline],
    );

    useEffect(() => {
        if (!isOnline) {
            return;
        }

        const automaticSync = window.setTimeout(() => void syncNow(), 0);

        return () => window.clearTimeout(automaticSync);
    }, [isOnline, syncNow]);

    return {
        sales,
        transactions: sales,
        pendingCount: sales.length,
        status,
        lastError,
        storageError,
        isOnline,
        enqueue,
        submit,
        syncNow,
        refresh,
    };
}
