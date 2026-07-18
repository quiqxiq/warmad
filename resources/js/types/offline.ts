import type { BatchTransactionPayload, SaleDraft } from './cashier';

export type HeldSale = {
    id: string;
    outletId: number;
    shiftId: number;
    draft: SaleDraft;
    createdAt: string;
    updatedAt: string;
};

export type PendingSaleStatus = 'pending' | 'syncing' | 'failed';

export type PendingSale = {
    clientUuid: string;
    payload: BatchTransactionPayload;
    status: PendingSaleStatus;
    attempts: number;
    createdAt: string;
    updatedAt: string;
    lastError?: string;
};

export type PendingTransactionStatus = PendingSaleStatus;
export type PendingTransaction = PendingSale;

export type OfflineSaleSyncStatus =
    'synced' | 'pending' | 'syncing' | 'offline' | 'error';

export type OfflineSaleSubmissionResult = 'sent' | 'queued';

export type OfflineDatabaseStoreName =
    'voice_notes' | 'held_sales' | 'pending_sales';
