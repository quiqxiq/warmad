import type {
    HeldSale,
    OfflineDatabaseStoreName,
    OfflineOwner,
    PendingReconciliation,
    PendingSale,
    VoiceNote,
} from '@/types';

const DATABASE_NAME = 'amanah-cashier';
const DATABASE_VERSION = 4;
const CHANNEL_NAME = 'amanah-cashier-storage-v3';
const OWNER_INDEX = 'owner';

export const OFFLINE_DATABASE_EVENT = 'amanah:offline-database';
export const OFFLINE_DATABASE_STORES = {
    voiceNotes: 'voice_notes_v3',
    heldSales: 'held_sales_v3',
    pendingSales: 'pending_sales_v3',
    pendingReconciliations: 'pending_reconciliations_v4',
} as const satisfies Record<string, OfflineDatabaseStoreName>;

export type OfflineStorageEventDetail = OfflineOwner & {
    store: OfflineDatabaseStoreName;
};

type StoredRecord<T> = T & OfflineOwner;

export class OfflineDatabaseUnavailableError extends Error {
    constructor(
        message = 'Penyimpanan offline tidak tersedia di browser ini.',
    ) {
        super(message);
        this.name = 'OfflineDatabaseUnavailableError';
    }
}

let databasePromise: Promise<IDBDatabase> | null = null;
let storageChannel: BroadcastChannel | null = null;

export function isOfflineDatabaseSupported(): boolean {
    return typeof window !== 'undefined' && 'indexedDB' in window;
}

function compoundKey(owner: OfflineOwner, id: string): IDBValidKey {
    return [owner.tenantId, owner.userId, id];
}

function ownerKey(owner: OfflineOwner): IDBValidKey {
    return [owner.tenantId, owner.userId];
}

function withOwner<T extends object>(
    owner: OfflineOwner,
    value: T,
): T & OfflineOwner {
    return {
        ...value,
        tenantId: owner.tenantId,
        userId: owner.userId,
    };
}

function withoutOwner<T>(stored: StoredRecord<T>): T {
    const value = { ...stored } as Record<string, unknown>;

    Reflect.deleteProperty(value, 'tenantId');
    Reflect.deleteProperty(value, 'userId');

    return value as T;
}

function dispatchStorageEvent(detail: OfflineStorageEventDetail): void {
    if (typeof window === 'undefined') {
        return;
    }

    window.dispatchEvent(
        new CustomEvent<OfflineStorageEventDetail>(OFFLINE_DATABASE_EVENT, {
            detail,
        }),
    );
}

function getStorageChannel(): BroadcastChannel | null {
    if (typeof BroadcastChannel === 'undefined') {
        return null;
    }

    if (!storageChannel) {
        storageChannel = new BroadcastChannel(CHANNEL_NAME);
        storageChannel.onmessage = (
            event: MessageEvent<OfflineStorageEventDetail>,
        ) => {
            if (event.data?.store) {
                dispatchStorageEvent(event.data);
            }
        };
    }

    return storageChannel;
}

function announceStorageChange(
    owner: OfflineOwner,
    store: OfflineDatabaseStoreName,
): void {
    const detail = { ...owner, store } satisfies OfflineStorageEventDetail;

    dispatchStorageEvent(detail);
    getStorageChannel()?.postMessage(detail);
}

function createScopedStore(
    database: IDBDatabase,
    storeName: OfflineDatabaseStoreName,
    idPath: string,
): IDBObjectStore {
    const store = database.createObjectStore(storeName, {
        keyPath: ['tenantId', 'userId', idPath],
    });

    store.createIndex(OWNER_INDEX, ['tenantId', 'userId'], { unique: false });

    return store;
}

function upgradeDatabase(database: IDBDatabase): void {
    if (
        !database.objectStoreNames.contains(OFFLINE_DATABASE_STORES.voiceNotes)
    ) {
        const store = createScopedStore(
            database,
            OFFLINE_DATABASE_STORES.voiceNotes,
            'id',
        );
        store.createIndex('ownerOutlet', ['tenantId', 'userId', 'outletId'], {
            unique: false,
        });
    }

    if (
        !database.objectStoreNames.contains(OFFLINE_DATABASE_STORES.heldSales)
    ) {
        const store = createScopedStore(
            database,
            OFFLINE_DATABASE_STORES.heldSales,
            'id',
        );
        store.createIndex('ownerOutlet', ['tenantId', 'userId', 'outletId'], {
            unique: false,
        });
    }

    if (
        !database.objectStoreNames.contains(
            OFFLINE_DATABASE_STORES.pendingSales,
        )
    ) {
        const store = createScopedStore(
            database,
            OFFLINE_DATABASE_STORES.pendingSales,
            'clientUuid',
        );
        store.createIndex(
            'ownerOutlet',
            ['tenantId', 'userId', 'payload.outlet_id'],
            { unique: false },
        );
    }

    if (
        !database.objectStoreNames.contains(
            OFFLINE_DATABASE_STORES.pendingReconciliations,
        )
    ) {
        const store = createScopedStore(
            database,
            OFFLINE_DATABASE_STORES.pendingReconciliations,
            'clientUuid',
        );
        store.createIndex(
            'ownerShift',
            ['tenantId', 'userId', 'payload.shift_id'],
            { unique: false },
        );
    }
}

function openDatabase(): Promise<IDBDatabase> {
    if (databasePromise) {
        return databasePromise;
    }

    if (!isOfflineDatabaseSupported()) {
        return Promise.reject(new OfflineDatabaseUnavailableError());
    }

    databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
        const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

        request.onupgradeneeded = () => upgradeDatabase(request.result);
        request.onsuccess = () => {
            const database = request.result;
            database.onversionchange = () => {
                database.close();
                databasePromise = null;
            };
            resolve(database);
        };
        request.onerror = () => {
            databasePromise = null;
            reject(
                request.error ??
                    new OfflineDatabaseUnavailableError(
                        'Penyimpanan offline gagal dibuka.',
                    ),
            );
        };
        request.onblocked = () => {
            databasePromise = null;
            reject(
                new OfflineDatabaseUnavailableError(
                    'Tutup tab Amanah lain, lalu coba kembali.',
                ),
            );
        };
    });

    return databasePromise;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
    });
}

async function getAllForOwner<T>(
    owner: OfflineOwner,
    storeName: OfflineDatabaseStoreName,
): Promise<T[]> {
    const database = await openDatabase();
    const transaction = database.transaction(storeName, 'readonly');
    const records = await requestResult(
        transaction
            .objectStore(storeName)
            .index(OWNER_INDEX)
            .getAll(IDBKeyRange.only(ownerKey(owner))),
    );

    return (records as StoredRecord<T>[]).map(withoutOwner);
}

async function getOneForOwner<T>(
    owner: OfflineOwner,
    storeName: OfflineDatabaseStoreName,
    id: string,
): Promise<T | undefined> {
    const database = await openDatabase();
    const transaction = database.transaction(storeName, 'readonly');
    const record = (await requestResult(
        transaction.objectStore(storeName).get(compoundKey(owner, id)),
    )) as StoredRecord<T> | undefined;

    return record ? withoutOwner(record) : undefined;
}

async function putForOwner<T extends object>(
    owner: OfflineOwner,
    storeName: OfflineDatabaseStoreName,
    value: T,
): Promise<void> {
    const database = await openDatabase();
    const transaction = database.transaction(storeName, 'readwrite');
    const complete = transactionComplete(transaction);

    await requestResult(
        transaction.objectStore(storeName).put(withOwner(owner, value)),
    );
    await complete;
    announceStorageChange(owner, storeName);
}

async function removeForOwner(
    owner: OfflineOwner,
    storeName: OfflineDatabaseStoreName,
    id: string,
): Promise<void> {
    const database = await openDatabase();
    const transaction = database.transaction(storeName, 'readwrite');
    const complete = transactionComplete(transaction);

    await requestResult(
        transaction.objectStore(storeName).delete(compoundKey(owner, id)),
    );
    await complete;
    announceStorageChange(owner, storeName);
}

export async function closeOfflineDatabase(): Promise<void> {
    const database = await databasePromise;

    database?.close();
    databasePromise = null;
}

export function getVoiceNote(
    owner: OfflineOwner,
    id: string,
): Promise<VoiceNote | undefined> {
    return getOneForOwner(owner, OFFLINE_DATABASE_STORES.voiceNotes, id);
}

export async function getVoiceNotes(
    owner: OfflineOwner,
    outletId?: number,
): Promise<VoiceNote[]> {
    const notes = await getAllForOwner<VoiceNote>(
        owner,
        OFFLINE_DATABASE_STORES.voiceNotes,
    );

    return notes
        .filter((note) => outletId === undefined || note.outletId === outletId)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function putVoiceNote(
    owner: OfflineOwner,
    note: VoiceNote,
): Promise<void> {
    return putForOwner(owner, OFFLINE_DATABASE_STORES.voiceNotes, note);
}

export function deleteVoiceNote(
    owner: OfflineOwner,
    id: string,
): Promise<void> {
    return removeForOwner(owner, OFFLINE_DATABASE_STORES.voiceNotes, id);
}

/**
 * Atomically claim a voice note for review so it produces at most one sale.
 * Succeeds only when the note is currently `open` (or has no state yet, for
 * notes recorded before this field existed). A note already `claimed` or
 * `consumed` cannot be claimed again — this blocks duplicate submissions across
 * reopens and multiple tabs. Returns the claimed note, or `undefined` if the
 * claim was refused.
 */
export async function claimVoiceNoteForSale(
    owner: OfflineOwner,
    id: string,
): Promise<VoiceNote | undefined> {
    const database = await openDatabase();
    const transaction = database.transaction(
        OFFLINE_DATABASE_STORES.voiceNotes,
        'readwrite',
    );
    const complete = transactionComplete(transaction);
    const store = transaction.objectStore(OFFLINE_DATABASE_STORES.voiceNotes);
    const key = compoundKey(owner, id);
    const stored = (await requestResult(store.get(key))) as
        | StoredRecord<VoiceNote>
        | undefined;
    const current = stored ? withoutOwner(stored) : null;

    // Only an `open` note (or a legacy note with no state yet) can be claimed.
    // A note already `claimed` (held) or `consumed` (submitted) is refused so it
    // cannot spawn a second competing draft.
    if (!current || (current.saleState && current.saleState !== 'open')) {
        await complete;

        return undefined;
    }

    const claimed: VoiceNote = {
        ...current,
        saleUuid: current.saleUuid ?? id,
        saleState: 'claimed',
        updatedAt: new Date().toISOString(),
    };

    await requestResult(store.put(withOwner(owner, claimed)));
    await complete;
    announceStorageChange(owner, OFFLINE_DATABASE_STORES.voiceNotes);

    return claimed;
}

/**
 * Atomically transition a voice note's sale state (e.g. release a claim back to
 * `open` when review is cancelled, or mark it `consumed` after the sale is
 * durably persisted). Refuses to move a `consumed` note back to an earlier state.
 */
export async function setVoiceNoteSaleState(
    owner: OfflineOwner,
    id: string,
    saleState: VoiceNote['saleState'],
): Promise<boolean> {
    const database = await openDatabase();
    const transaction = database.transaction(
        OFFLINE_DATABASE_STORES.voiceNotes,
        'readwrite',
    );
    const complete = transactionComplete(transaction);
    const store = transaction.objectStore(OFFLINE_DATABASE_STORES.voiceNotes);
    const key = compoundKey(owner, id);
    const stored = (await requestResult(store.get(key))) as
        | StoredRecord<VoiceNote>
        | undefined;
    const current = stored ? withoutOwner(stored) : null;

    if (!current || current.saleState === 'consumed') {
        await complete;

        return false;
    }

    await requestResult(
        store.put(
            withOwner(owner, {
                ...current,
                saleState,
                updatedAt: new Date().toISOString(),
            }),
        ),
    );
    await complete;
    announceStorageChange(owner, OFFLINE_DATABASE_STORES.voiceNotes);

    return true;
}

export function getHeldSale(
    owner: OfflineOwner,
    id: string,
): Promise<HeldSale | undefined> {
    return getOneForOwner(owner, OFFLINE_DATABASE_STORES.heldSales, id);
}

export async function getHeldSales(
    owner: OfflineOwner,
    outletId?: number,
): Promise<HeldSale[]> {
    const sales = await getAllForOwner<HeldSale>(
        owner,
        OFFLINE_DATABASE_STORES.heldSales,
    );

    return sales
        .filter((sale) => outletId === undefined || sale.outletId === outletId)
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function putHeldSale(
    owner: OfflineOwner,
    sale: HeldSale,
): Promise<void> {
    return putForOwner(owner, OFFLINE_DATABASE_STORES.heldSales, sale);
}

export function deleteHeldSale(owner: OfflineOwner, id: string): Promise<void> {
    return removeForOwner(owner, OFFLINE_DATABASE_STORES.heldSales, id);
}

function normalizePendingSale(sale: PendingSale): PendingSale {
    return {
        ...sale,
        revision: sale.revision || 1,
    };
}

export async function getPendingSale(
    owner: OfflineOwner,
    clientUuid: string,
): Promise<PendingSale | undefined> {
    const sale = await getOneForOwner<PendingSale>(
        owner,
        OFFLINE_DATABASE_STORES.pendingSales,
        clientUuid,
    );

    return sale ? normalizePendingSale(sale) : undefined;
}

export async function getPendingSales(
    owner: OfflineOwner,
    outletId?: number,
): Promise<PendingSale[]> {
    const sales = await getAllForOwner<PendingSale>(
        owner,
        OFFLINE_DATABASE_STORES.pendingSales,
    );

    return sales
        .map(normalizePendingSale)
        .filter(
            (sale) =>
                outletId === undefined || sale.payload.outlet_id === outletId,
        )
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export function putPendingSale(
    owner: OfflineOwner,
    sale: PendingSale,
): Promise<void> {
    return putForOwner(owner, OFFLINE_DATABASE_STORES.pendingSales, sale);
}

export async function claimPendingSale(
    owner: OfflineOwner,
    clientUuid: string,
    expectedRevision: number,
): Promise<PendingSale | undefined> {
    const database = await openDatabase();
    const transaction = database.transaction(
        OFFLINE_DATABASE_STORES.pendingSales,
        'readwrite',
    );
    const complete = transactionComplete(transaction);
    const store = transaction.objectStore(OFFLINE_DATABASE_STORES.pendingSales);
    const key = compoundKey(owner, clientUuid);
    const stored = (await requestResult(store.get(key))) as
        StoredRecord<PendingSale> | undefined;
    const current = stored ? normalizePendingSale(withoutOwner(stored)) : null;

    if (!current || current.revision !== expectedRevision) {
        await complete;

        return undefined;
    }

    const claimed: PendingSale = {
        ...current,
        revision: current.revision + 1,
        status: 'syncing',
        attempts: current.attempts + 1,
        updatedAt: new Date().toISOString(),
        nextAttemptAt: undefined,
        lastError: undefined,
    };

    await requestResult(store.put(withOwner(owner, claimed)));
    await complete;
    announceStorageChange(owner, OFFLINE_DATABASE_STORES.pendingSales);

    return claimed;
}

export async function updatePendingSaleIfRevision(
    owner: OfflineOwner,
    clientUuid: string,
    expectedRevision: number,
    update: (sale: PendingSale) => PendingSale,
): Promise<boolean> {
    const database = await openDatabase();
    const transaction = database.transaction(
        OFFLINE_DATABASE_STORES.pendingSales,
        'readwrite',
    );
    const complete = transactionComplete(transaction);
    const store = transaction.objectStore(OFFLINE_DATABASE_STORES.pendingSales);
    const key = compoundKey(owner, clientUuid);
    const stored = (await requestResult(store.get(key))) as
        StoredRecord<PendingSale> | undefined;
    const current = stored ? normalizePendingSale(withoutOwner(stored)) : null;

    if (!current || current.revision !== expectedRevision) {
        await complete;

        return false;
    }

    await requestResult(store.put(withOwner(owner, update(current))));
    await complete;
    announceStorageChange(owner, OFFLINE_DATABASE_STORES.pendingSales);

    return true;
}

export async function deletePendingSaleIfRevision(
    owner: OfflineOwner,
    clientUuid: string,
    expectedRevision: number,
): Promise<boolean> {
    const database = await openDatabase();
    const transaction = database.transaction(
        OFFLINE_DATABASE_STORES.pendingSales,
        'readwrite',
    );
    const complete = transactionComplete(transaction);
    const store = transaction.objectStore(OFFLINE_DATABASE_STORES.pendingSales);
    const key = compoundKey(owner, clientUuid);
    const stored = (await requestResult(store.get(key))) as
        StoredRecord<PendingSale> | undefined;
    const current = stored ? normalizePendingSale(withoutOwner(stored)) : null;

    if (!current || current.revision !== expectedRevision) {
        await complete;

        return false;
    }

    await requestResult(store.delete(key));
    await complete;
    announceStorageChange(owner, OFFLINE_DATABASE_STORES.pendingSales);

    return true;
}

function normalizePendingReconciliation(
    reconciliation: PendingReconciliation,
): PendingReconciliation {
    return {
        ...reconciliation,
        revision: reconciliation.revision || 1,
    };
}

export async function getPendingReconciliation(
    owner: OfflineOwner,
    clientUuid: string,
): Promise<PendingReconciliation | undefined> {
    const reconciliation = await getOneForOwner<PendingReconciliation>(
        owner,
        OFFLINE_DATABASE_STORES.pendingReconciliations,
        clientUuid,
    );

    return reconciliation
        ? normalizePendingReconciliation(reconciliation)
        : undefined;
}

export async function getPendingReconciliations(
    owner: OfflineOwner,
): Promise<PendingReconciliation[]> {
    const reconciliations = await getAllForOwner<PendingReconciliation>(
        owner,
        OFFLINE_DATABASE_STORES.pendingReconciliations,
    );

    return reconciliations
        .map(normalizePendingReconciliation)
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export function putPendingReconciliation(
    owner: OfflineOwner,
    reconciliation: PendingReconciliation,
): Promise<void> {
    return putForOwner(
        owner,
        OFFLINE_DATABASE_STORES.pendingReconciliations,
        reconciliation,
    );
}

export async function claimPendingReconciliation(
    owner: OfflineOwner,
    clientUuid: string,
    expectedRevision: number,
): Promise<PendingReconciliation | undefined> {
    const database = await openDatabase();
    const transaction = database.transaction(
        OFFLINE_DATABASE_STORES.pendingReconciliations,
        'readwrite',
    );
    const complete = transactionComplete(transaction);
    const store = transaction.objectStore(
        OFFLINE_DATABASE_STORES.pendingReconciliations,
    );
    const key = compoundKey(owner, clientUuid);
    const stored = (await requestResult(store.get(key))) as
        | StoredRecord<PendingReconciliation>
        | undefined;
    const current = stored
        ? normalizePendingReconciliation(withoutOwner(stored))
        : null;

    if (!current || current.revision !== expectedRevision) {
        await complete;

        return undefined;
    }

    const claimed: PendingReconciliation = {
        ...current,
        revision: current.revision + 1,
        status: 'syncing',
        attempts: current.attempts + 1,
        updatedAt: new Date().toISOString(),
        nextAttemptAt: undefined,
        lastError: undefined,
    };

    await requestResult(store.put(withOwner(owner, claimed)));
    await complete;
    announceStorageChange(owner, OFFLINE_DATABASE_STORES.pendingReconciliations);

    return claimed;
}

export async function updatePendingReconciliationIfRevision(
    owner: OfflineOwner,
    clientUuid: string,
    expectedRevision: number,
    update: (reconciliation: PendingReconciliation) => PendingReconciliation,
): Promise<boolean> {
    const database = await openDatabase();
    const transaction = database.transaction(
        OFFLINE_DATABASE_STORES.pendingReconciliations,
        'readwrite',
    );
    const complete = transactionComplete(transaction);
    const store = transaction.objectStore(
        OFFLINE_DATABASE_STORES.pendingReconciliations,
    );
    const key = compoundKey(owner, clientUuid);
    const stored = (await requestResult(store.get(key))) as
        | StoredRecord<PendingReconciliation>
        | undefined;
    const current = stored
        ? normalizePendingReconciliation(withoutOwner(stored))
        : null;

    if (!current || current.revision !== expectedRevision) {
        await complete;

        return false;
    }

    await requestResult(store.put(withOwner(owner, update(current))));
    await complete;
    announceStorageChange(owner, OFFLINE_DATABASE_STORES.pendingReconciliations);

    return true;
}

export async function deletePendingReconciliationIfRevision(
    owner: OfflineOwner,
    clientUuid: string,
    expectedRevision: number,
): Promise<boolean> {
    const database = await openDatabase();
    const transaction = database.transaction(
        OFFLINE_DATABASE_STORES.pendingReconciliations,
        'readwrite',
    );
    const complete = transactionComplete(transaction);
    const store = transaction.objectStore(
        OFFLINE_DATABASE_STORES.pendingReconciliations,
    );
    const key = compoundKey(owner, clientUuid);
    const stored = (await requestResult(store.get(key))) as
        | StoredRecord<PendingReconciliation>
        | undefined;
    const current = stored
        ? normalizePendingReconciliation(withoutOwner(stored))
        : null;

    if (!current || current.revision !== expectedRevision) {
        await complete;

        return false;
    }

    await requestResult(store.delete(key));
    await complete;
    announceStorageChange(owner, OFFLINE_DATABASE_STORES.pendingReconciliations);

    return true;
}
