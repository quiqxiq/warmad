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
    putVoiceNote,
} from '@/lib/offline-database';
import { createUuid } from '@/lib/uuid';
import type {
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
};

const processableStatuses: VoiceQueueStatus[] = [
    'queued',
    'waiting_network',
    'uploading',
    'processing',
];

let voiceWorkerPromise: Promise<void> | null = null;

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

async function processVoiceNote(note: VoiceNote): Promise<void> {
    const now = new Date().toISOString();
    const uploadingNote: VoiceNote = {
        ...note,
        status: 'uploading',
        attempts: note.attempts + 1,
        updatedAt: now,
        error: undefined,
    };

    await putVoiceNote(uploadingNote);

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
        );
        const processingNote: VoiceNote = {
            ...uploadingNote,
            status: 'processing',
            updatedAt: new Date().toISOString(),
        };

        await putVoiceNote(processingNote);
        await putVoiceNote({
            ...processingNote,
            status: needsReview(response.data) ? 'needs_review' : 'ready',
            result: response.data,
            updatedAt: new Date().toISOString(),
        });
    } catch (error) {
        await putVoiceNote({
            ...uploadingNote,
            status: isNetworkError(error) ? 'waiting_network' : 'failed',
            error: getRequestErrorMessage(error),
            updatedAt: new Date().toISOString(),
        });
    }
}

async function runVoiceWorker(): Promise<void> {
    while (typeof navigator !== 'undefined' && navigator.onLine) {
        const notes = await getVoiceNotes();
        const nextNote = notes
            .filter((note) => processableStatuses.includes(note.status))
            .sort((left, right) =>
                left.createdAt.localeCompare(right.createdAt),
            )[0];

        if (!nextNote) {
            return;
        }

        await processVoiceNote(nextNote);

        const updatedNote = await getVoiceNote(nextNote.id);

        if (updatedNote?.status === 'waiting_network') {
            return;
        }
    }
}

function startVoiceWorker(): Promise<void> {
    if (voiceWorkerPromise) {
        return voiceWorkerPromise;
    }

    voiceWorkerPromise = runVoiceWorker().finally(() => {
        voiceWorkerPromise = null;
    });

    return voiceWorkerPromise;
}

export function useVoiceQueue(outletId: number | null) {
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
            setNotes(await getVoiceNotes(outletId));
            setStorageError(null);
        } catch (error) {
            setStorageError(getRequestErrorMessage(error));
        } finally {
            setIsLoading(false);
        }
    }, [outletId]);

    useEffect(() => {
        const initialRefresh = window.setTimeout(() => void refresh(), 0);

        const handleStorageChange = (event: Event) => {
            const detail = (event as CustomEvent<{ store?: string }>).detail;

            if (
                !detail?.store ||
                detail.store === OFFLINE_DATABASE_STORES.voiceNotes
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

    useEffect(() => {
        if (outletId === null) {
            return;
        }

        if (isOnline) {
            void startVoiceWorker();

            return;
        }

        void getVoiceNotes(outletId)
            .then((storedNotes) =>
                Promise.all(
                    storedNotes
                        .filter((note) => note.status === 'queued')
                        .map((note) =>
                            putVoiceNote({
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
    }, [isOnline, outletId]);

    const enqueue = useCallback(
        async ({ blob, durationMs, mimeType }: EnqueueVoiceNote) => {
            if (outletId === null) {
                throw new Error('Pilih outlet sebelum merekam transaksi.');
            }

            const now = new Date().toISOString();
            const note: VoiceNote = {
                id: createUuid(),
                outletId,
                audio: blob,
                mimeType,
                durationMs,
                status: isOnline ? 'queued' : 'waiting_network',
                attempts: 0,
                createdAt: now,
                updatedAt: now,
            };

            await putVoiceNote(note);

            if (isOnline) {
                void startVoiceWorker();
            }

            return note;
        },
        [isOnline, outletId],
    );

    const retry = useCallback(
        async (id: string) => {
            const note = await getVoiceNote(id);

            if (!note) {
                return;
            }

            await putVoiceNote({
                ...note,
                status: isOnline ? 'queued' : 'waiting_network',
                error: undefined,
                updatedAt: new Date().toISOString(),
            });

            if (isOnline) {
                void startVoiceWorker();
            }
        },
        [isOnline],
    );

    const remove = useCallback(async (id: string) => {
        await deleteVoiceNote(id);
    }, []);

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
