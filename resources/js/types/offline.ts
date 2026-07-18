import type { BatchTransactionPayload, SaleDraft } from './cashier';

export type OfflineOwner = {
    tenantId: number;
    userId: number;
};

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
    revision: number;
    payload: BatchTransactionPayload;
    status: PendingSaleStatus;
    attempts: number;
    nextAttemptAt?: string;
    createdAt: string;
    updatedAt: string;
    lastError?: string;
};

export type PendingTransactionStatus = PendingSaleStatus;
export type PendingTransaction = PendingSale;

export type OfflineSaleSyncStatus =
    'synced' | 'pending' | 'syncing' | 'offline' | 'error';

export type OfflineSaleSubmissionResult = 'sent' | 'queued';

export type ReconciliationPayload = {
    client_uuid: string;
    shift_id: number;
    actual_cash: number;
    note: string | null;
};

export type PendingReconciliation = {
    clientUuid: string;
    revision: number;
    outletId: number;
    payload: ReconciliationPayload;
    status: PendingSaleStatus;
    attempts: number;
    nextAttemptAt?: string;
    createdAt: string;
    updatedAt: string;
    lastError?: string;
};

export type OfflineDatabaseStoreName =
    | 'voice_notes_v3'
    | 'held_sales_v3'
    | 'pending_sales_v3'
    | 'pending_reconciliations_v4';
