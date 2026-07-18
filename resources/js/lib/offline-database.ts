import type {
    HeldSale,
    OfflineDatabaseStoreName,
    PendingSale,
    VoiceNote,
    VoiceQueueStatus,
} from '@/types';

const DATABASE_NAME = 'amanah-cashier';
const DATABASE_VERSION = 2;
const CHANNEL_NAME = 'amanah-cashier-storage';

const LEGACY_STORES = {
    voiceNotes: 'voice-notes',
    heldSales: 'held-sales',
    pendingSales: 'pending-transactions',
} as const;

export const OFFLINE_DATABASE_EVENT = 'amanah:offline-database';
export const OFFLINE_DATABASE_STORES = {
    voiceNotes: 'voice_notes',
    heldSales: 'held_sales',
    pendingSales: 'pending_sales',
} as const satisfies Record<string, OfflineDatabaseStoreName>;

export class OfflineDatabaseUnavailableError extends Error {
    constructor(
        message = 'Penyimpanan offline tidak tersedia di browser ini.',
    ) {
        super(message);
        this.name = 'OfflineDatabaseUnavailableError';
    }
}

type StorageEventDetail = {
    store: OfflineDatabaseStoreName;
};

type LegacyVoiceNote = Omit<VoiceNote, 'status'> & {
    status: 'waiting' | 'offline' | 'parsing' | VoiceQueueStatus;
};

let databasePromise: Promise<IDBDatabase> | null = null;
let storageChannel: BroadcastChannel | null = null;

export function isOfflineDatabaseSupported(): boolean {
    return typeof window !== 'undefined' && 'indexedDB' in window;
}

function dispatchStorageEvent(store: OfflineDatabaseStoreName): void {
    if (typeof window === 'undefined') {
        return;
    }

    window.dispatchEvent(
        new CustomEvent<StorageEventDetail>(OFFLINE_DATABASE_EVENT, {
            detail: { store },
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
            event: MessageEvent<StorageEventDetail>,
        ) => {
            if (event.data?.store) {
                dispatchStorageEvent(event.data.store);
            }
        };
    }

    return storageChannel;
}

function announceStorageChange(store: OfflineDatabaseStoreName): void {
    dispatchStorageEvent(store);
    getStorageChannel()?.postMessage({ store } satisfies StorageEventDetail);
}

function normalizeLegacyVoiceNote(note: LegacyVoiceNote): VoiceNote {
    const legacyStatuses: Record<
        'waiting' | 'offline' | 'parsing',
        VoiceQueueStatus
    > = {
        waiting: 'queued',
        offline: 'waiting_network',
        parsing: 'processing',
    };

    return {
        ...note,
        status:
            note.status in legacyStatuses
                ? legacyStatuses[note.status as keyof typeof legacyStatuses]
                : (note.status as VoiceQueueStatus),
    };
}

function copyLegacyStore(
    transaction: IDBTransaction,
    legacyStoreName: string,
    targetStoreName: OfflineDatabaseStoreName,
    transform?: (value: unknown) => unknown,
): void {
    if (!transaction.db.objectStoreNames.contains(legacyStoreName)) {
        return;
    }

    const source = transaction.objectStore(legacyStoreName);
    const target = transaction.objectStore(targetStoreName);
    const cursorRequest = source.openCursor();

    cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;

        if (!cursor) {
            return;
        }

        target.put(transform ? transform(cursor.value) : cursor.value);
        cursor.continue();
    };
}

function upgradeDatabase(
    database: IDBDatabase,
    transaction: IDBTransaction,
): void {
    if (
        !database.objectStoreNames.contains(OFFLINE_DATABASE_STORES.voiceNotes)
    ) {
        const store = database.createObjectStore(
            OFFLINE_DATABASE_STORES.voiceNotes,
            { keyPath: 'id' },
        );
        store.createIndex('outletId', 'outletId', { unique: false });
        store.createIndex('status', 'status', { unique: false });
    }

    if (
        !database.objectStoreNames.contains(OFFLINE_DATABASE_STORES.heldSales)
    ) {
        const store = database.createObjectStore(
            OFFLINE_DATABASE_STORES.heldSales,
            { keyPath: 'id' },
        );
        store.createIndex('outletId', 'outletId', { unique: false });
    }

    if (
        !database.objectStoreNames.contains(
            OFFLINE_DATABASE_STORES.pendingSales,
        )
    ) {
        const store = database.createObjectStore(
            OFFLINE_DATABASE_STORES.pendingSales,
            { keyPath: 'clientUuid' },
        );
        store.createIndex('outletId', 'payload.outlet_id', { unique: false });
        store.createIndex('status', 'status', { unique: false });
    }

    copyLegacyStore(
        transaction,
        LEGACY_STORES.voiceNotes,
        OFFLINE_DATABASE_STORES.voiceNotes,
        (value) => normalizeLegacyVoiceNote(value as LegacyVoiceNote),
    );
    copyLegacyStore(
        transaction,
        LEGACY_STORES.heldSales,
        OFFLINE_DATABASE_STORES.heldSales,
    );
    copyLegacyStore(
        transaction,
        LEGACY_STORES.pendingSales,
        OFFLINE_DATABASE_STORES.pendingSales,
    );
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

        request.onupgradeneeded = () => {
            const transaction = request.transaction;

            if (!transaction) {
                throw new OfflineDatabaseUnavailableError(
                    'Penyimpanan offline gagal disiapkan.',
                );
            }

            upgradeDatabase(request.result, transaction);
        };
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

async function getAll<T>(storeName: OfflineDatabaseStoreName): Promise<T[]> {
    const database = await openDatabase();
    const transaction = database.transaction(storeName, 'readonly');

    return requestResult(
        transaction.objectStore(storeName).getAll(),
    ) as Promise<T[]>;
}

async function getOne<T>(
    storeName: OfflineDatabaseStoreName,
    key: IDBValidKey,
): Promise<T | undefined> {
    const database = await openDatabase();
    const transaction = database.transaction(storeName, 'readonly');

    return requestResult(
        transaction.objectStore(storeName).get(key),
    ) as Promise<T | undefined>;
}

async function put<T>(
    storeName: OfflineDatabaseStoreName,
    value: T,
): Promise<void> {
    const database = await openDatabase();
    const transaction = database.transaction(storeName, 'readwrite');
    const complete = transactionComplete(transaction);

    await requestResult(transaction.objectStore(storeName).put(value));
    await complete;
    announceStorageChange(storeName);
}

async function remove(
    storeName: OfflineDatabaseStoreName,
    key: IDBValidKey,
): Promise<void> {
    const database = await openDatabase();
    const transaction = database.transaction(storeName, 'readwrite');
    const complete = transactionComplete(transaction);

    await requestResult(transaction.objectStore(storeName).delete(key));
    await complete;
    announceStorageChange(storeName);
}

export function getVoiceNote(id: string): Promise<VoiceNote | undefined> {
    return getOne(OFFLINE_DATABASE_STORES.voiceNotes, id);
}

export async function getVoiceNotes(outletId?: number): Promise<VoiceNote[]> {
    const notes = await getAll<VoiceNote>(OFFLINE_DATABASE_STORES.voiceNotes);

    return notes
        .filter((note) => outletId === undefined || note.outletId === outletId)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function putVoiceNote(note: VoiceNote): Promise<void> {
    return put(OFFLINE_DATABASE_STORES.voiceNotes, note);
}

export function deleteVoiceNote(id: string): Promise<void> {
    return remove(OFFLINE_DATABASE_STORES.voiceNotes, id);
}

export function getHeldSale(id: string): Promise<HeldSale | undefined> {
    return getOne(OFFLINE_DATABASE_STORES.heldSales, id);
}

export async function getHeldSales(outletId?: number): Promise<HeldSale[]> {
    const sales = await getAll<HeldSale>(OFFLINE_DATABASE_STORES.heldSales);

    return sales
        .filter((sale) => outletId === undefined || sale.outletId === outletId)
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function putHeldSale(sale: HeldSale): Promise<void> {
    return put(OFFLINE_DATABASE_STORES.heldSales, sale);
}

export function deleteHeldSale(id: string): Promise<void> {
    return remove(OFFLINE_DATABASE_STORES.heldSales, id);
}

export function getPendingSale(
    clientUuid: string,
): Promise<PendingSale | undefined> {
    return getOne(OFFLINE_DATABASE_STORES.pendingSales, clientUuid);
}

export async function getPendingSales(
    outletId?: number,
): Promise<PendingSale[]> {
    const sales = await getAll<PendingSale>(
        OFFLINE_DATABASE_STORES.pendingSales,
    );

    return sales
        .filter(
            (sale) =>
                outletId === undefined || sale.payload.outlet_id === outletId,
        )
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export function putPendingSale(sale: PendingSale): Promise<void> {
    return put(OFFLINE_DATABASE_STORES.pendingSales, sale);
}

export function deletePendingSale(clientUuid: string): Promise<void> {
    return remove(OFFLINE_DATABASE_STORES.pendingSales, clientUuid);
}
