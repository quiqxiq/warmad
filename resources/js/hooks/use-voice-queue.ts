import { usePage } from '@inertiajs/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { parse } from '@/actions/App/Http/Controllers/Api/VoiceParserController';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { apiRequest, getRequestErrorMessage, isNetworkError } from '@/lib/api';
import {
    deleteVoiceNote,
    getVoiceNote,
    getVoiceNotes,
    OFFLINE_DATABASE_EVENT,
    OFFLINE_DATABASE_STORES,
    putVoiceNote
    
} from '@/lib/offline-database';
import type {OfflineStorageEventDetail} from '@/lib/offline-database';
import {
    getOfflineOwner,
    isSameOfflineOwner,
    offlineOwnerKey,
} from '@/lib/offline-owner';
import { createUuid } from '@/lib/uuid';
import type {
    OfflineOwner,
    VoiceNote,
    VoiceParseData,
    VoiceParseResponse,
    VoiceQueueCounts,
    VoiceQueueStatus,
} from '@/types';

type EnqueueVoiceNote = {
    blob: Blob;
    durationMs: number;
    mimeType: string;
    shiftId: number | null;
};

const processableStatuses: VoiceQueueStatus[] = [
    'queued',
    'waiting_network',
    'uploading',
    'processing',
];

const voiceWorkers = new Map<
    string,
    { controller: AbortController; promise: Promise<void> }
>();

function needsReview(result: VoiceParseData): boolean {
    return (
        result.status === 'needs_review' ||
        result.warnings.length > 0 ||
        result.confidence < 0.75 ||
        result.items.some(
            (item) =>
                item.category_id === null ||
                item.needs_review ||
                item.confidence < 0.75,
        )
    );
}

function getAudioExtension(mimeType: string): string {
    return mimeType.includes('ogg') ? 'ogg' : 'webm';
}

async function processVoiceNote(
    owner: OfflineOwner,
    note: VoiceNote,
    signal: AbortSignal,
): Promise<void> {
    const now = new Date().toISOString();
    const uploadingNote: VoiceNote = {
        ...note,
        status: 'uploading',
        attempts: note.attempts + 1,
        updatedAt: now,
        error: undefined,
    };

    await putVoiceNote(owner, uploadingNote);

    try {
        const formData = new FormData();
        formData.append(
            'audio',
            note.audio,
            `amanah-${note.id}.${getAudioExtension(note.mimeType)}`,
        );
        formData.append('outlet_id', String(note.outletId));

        const response = await apiRequest<VoiceParseResponse>(
            parse(),
            formData,
            signal,
        );
        const processingNote: VoiceNote = {
            ...uploadingNote,
            status: 'processing',
            updatedAt: new Date().toISOString(),
        };

        await putVoiceNote(owner, processingNote);
        await putVoiceNote(owner, {
            ...processingNote,
            status: needsReview(response.data) ? 'needs_review' : 'ready',
            result: response.data,
            updatedAt: new Date().toISOString(),
        });
    } catch (error) {
        if (signal.aborted) {
            return;
        }

        await putVoiceNote(owner, {
            ...uploadingNote,
            status: isNetworkError(error) ? 'waiting_network' : 'failed',
            error: getRequestErrorMessage(error),
            updatedAt: new Date().toISOString(),
        });
    }
}

async function runVoiceWorker(
    owner: OfflineOwner,
    signal: AbortSignal,
): Promise<void> {
    while (
        typeof navigator !== 'undefined' &&
        navigator.onLine &&
        !signal.aborted
    ) {
        const notes = await getVoiceNotes(owner);
        const nextNote = notes
            .filter((note) => processableStatuses.includes(note.status))
            .sort((left, right) =>
                left.createdAt.localeCompare(right.createdAt),
            )[0];

        if (!nextNote) {
            return;
        }

        await processVoiceNote(owner, nextNote, signal);

        const updatedNote = await getVoiceNote(owner, nextNote.id);

        if (updatedNote?.status === 'waiting_network') {
            return;
        }
    }
}

function startVoiceWorker(owner: OfflineOwner): Promise<void> {
    const key = offlineOwnerKey(owner);
    const existingWorker = voiceWorkers.get(key);

    if (existingWorker) {
        return existingWorker.promise;
    }

    const controller = new AbortController();
    const promise = runVoiceWorker(owner, controller.signal).finally(() => {
        voiceWorkers.delete(key);
    });

    voiceWorkers.set(key, { controller, promise });

    return promise;
}

export function pauseVoiceWorker(owner: OfflineOwner): void {
    const key = offlineOwnerKey(owner);
    voiceWorkers.get(key)?.controller.abort();
    voiceWorkers.delete(key);
}

export function useVoiceQueue(outletId: number | null) {
    const { auth } = usePage().props;
    const owner = useMemo(() => getOfflineOwner(auth), [auth]);
    const { isOnline } = useNetworkStatus();
    const [notes, setNotes] = useState<VoiceNote[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [storageError, setStorageError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        if (outletId === null) {
            setNotes([]);
            setIsLoading(false);

            return;
        }

        try {
            setNotes(await getVoiceNotes(owner, outletId));
            setStorageError(null);
        } catch (error) {
            setStorageError(getRequestErrorMessage(error));
        } finally {
            setIsLoading(false);
        }
    }, [outletId, owner]);

    useEffect(() => {
        const initialRefresh = window.setTimeout(() => void refresh(), 0);

        const handleStorageChange = (event: Event) => {
            const detail = (event as CustomEvent<OfflineStorageEventDetail>)
                .detail;

            if (
                detail?.store === OFFLINE_DATABASE_STORES.voiceNotes &&
                isSameOfflineOwner(owner, detail)
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
    }, [owner, refresh]);

    useEffect(() => {
        if (outletId === null) {
            return;
        }

        if (isOnline) {
            void startVoiceWorker(owner);

            return;
        }

        void getVoiceNotes(owner, outletId)
            .then((storedNotes) =>
                Promise.all(
                    storedNotes
                        .filter((note) => note.status === 'queued')
                        .map((note) =>
                            putVoiceNote(owner, {
                                ...note,
                                status: 'waiting_network',
                                updatedAt: new Date().toISOString(),
                            }),
                        ),
                ),
            )
            .catch((error: unknown) => {
                setStorageError(getRequestErrorMessage(error));
            });
    }, [isOnline, outletId, owner]);

    const enqueue = useCallback(
        async ({ blob, durationMs, mimeType, shiftId }: EnqueueVoiceNote) => {
            if (outletId === null) {
                throw new Error('Pilih outlet sebelum merekam transaksi.');
            }

            const now = new Date().toISOString();
            const note: VoiceNote = {
                id: createUuid(),
                outletId,
                shiftId,
                audio: blob,
                mimeType,
                durationMs,
                status: isOnline ? 'queued' : 'waiting_network',
                attempts: 0,
                createdAt: now,
                updatedAt: now,
                saleUuid: createUuid(),
                saleState: 'open',
            };

            await putVoiceNote(owner, note);

            if (isOnline) {
                void startVoiceWorker(owner);
            }

            return note;
        },
        [isOnline, outletId, owner],
    );

    const retry = useCallback(
        async (id: string) => {
            const note = await getVoiceNote(owner, id);

            if (!note) {
                return;
            }

            await putVoiceNote(owner, {
                ...note,
                status: isOnline ? 'queued' : 'waiting_network',
                error: undefined,
                updatedAt: new Date().toISOString(),
            });

            if (isOnline) {
                void startVoiceWorker(owner);
            }
        },
        [isOnline, owner],
    );

    const remove = useCallback(
        async (id: string) => {
            await deleteVoiceNote(owner, id);
        },
        [owner],
    );

    const counts = useMemo<VoiceQueueCounts>(() => {
        const initialCounts: VoiceQueueCounts = {
            total: notes.length,
            queued: 0,
            waiting_network: 0,
            uploading: 0,
            processing: 0,
            ready: 0,
            needs_review: 0,
            failed: 0,
        };

        return notes.reduce((result, note) => {
            result[note.status] += 1;

            return result;
        }, initialCounts);
    }, [notes]);

    return {
        notes,
        counts,
        isLoading,
        isOnline,
        storageError,
        enqueue,
        retry,
        remove,
        refresh,
    };
}
