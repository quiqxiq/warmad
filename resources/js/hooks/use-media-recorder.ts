import { useCallback, useEffect, useRef, useState } from 'react';

export const MAX_RECORDING_DURATION_MS = 45_000;

export type RecordedAudio = {
    blob: Blob;
    durationMs: number;
    mimeType: string;
};

export type MediaRecorderStatus =
    'idle' | 'requesting' | 'recording' | 'stopping' | 'error';

type UseMediaRecorderOptions = {
    onRecorded: (recording: RecordedAudio) => void | Promise<void>;
};

function getSupportedMimeType(): string | undefined {
    const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/ogg',
    ];

    return mimeTypes.find((mimeType) =>
        MediaRecorder.isTypeSupported(mimeType),
    );
}

function getPermissionError(error: unknown): string {
    if (!(error instanceof DOMException)) {
        return 'Mikrofon tidak dapat digunakan. Silakan coba lagi.';
    }

    switch (error.name) {
        case 'NotAllowedError':
        case 'SecurityError':
            return 'Izinkan akses mikrofon untuk mencatat penjualan.';
        case 'NotFoundError':
            return 'Mikrofon tidak ditemukan di perangkat ini.';
        case 'NotReadableError':
            return 'Mikrofon sedang dipakai aplikasi lain.';
        default:
            return 'Mikrofon tidak dapat digunakan. Silakan coba lagi.';
    }
}

export function useMediaRecorder({ onRecorded }: UseMediaRecorderOptions) {
    const [status, setStatus] = useState<MediaRecorderStatus>('idle');
    const [durationMs, setDurationMs] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const recorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<BlobPart[]>([]);
    const startedAtRef = useRef(0);
    const intervalRef = useRef<number | null>(null);
    const timeoutRef = useRef<number | null>(null);
    const discardRef = useRef(false);
    const mountedRef = useRef(true);
    const onRecordedRef = useRef(onRecorded);

    useEffect(() => {
        onRecordedRef.current = onRecorded;
    }, [onRecorded]);

    const clearTimers = useCallback(() => {
        if (intervalRef.current !== null) {
            window.clearInterval(intervalRef.current);
            intervalRef.current = null;
        }

        if (timeoutRef.current !== null) {
            window.clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    }, []);

    const releaseTracks = useCallback((stream?: MediaStream) => {
        (stream ?? recorderRef.current?.stream)
            ?.getTracks()
            .forEach((track) => track.stop());
    }, []);

    const stop = useCallback(() => {
        if (recorderRef.current?.state === 'recording') {
            setStatus('stopping');
            recorderRef.current.stop();
        }
    }, []);

    const start = useCallback(async () => {
        if (
            status === 'recording' ||
            status === 'requesting' ||
            status === 'stopping'
        ) {
            return;
        }

        if (
            typeof MediaRecorder === 'undefined' ||
            !navigator.mediaDevices?.getUserMedia
        ) {
            setStatus('error');
            setError('Perekaman suara tidak didukung browser ini.');

            return;
        }

        setStatus('requesting');
        setError(null);
        setDurationMs(0);
        discardRef.current = false;

        let stream: MediaStream | undefined;

        try {
            stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
            });
            const mimeType = getSupportedMimeType();
            const recorder = mimeType
                ? new MediaRecorder(stream, { mimeType })
                : new MediaRecorder(stream);

            recorderRef.current = recorder;
            chunksRef.current = [];
            startedAtRef.current = Date.now();

            recorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    chunksRef.current.push(event.data);
                }
            };

            recorder.onerror = () => {
                clearTimers();
                releaseTracks();
                recorderRef.current = null;

                if (mountedRef.current) {
                    setStatus('error');
                    setError('Rekaman terhenti karena terjadi kesalahan.');
                }
            };

            recorder.onstop = () => {
                clearTimers();
                const finalDuration = Math.min(
                    Date.now() - startedAtRef.current,
                    MAX_RECORDING_DURATION_MS,
                );
                const blob = new Blob(chunksRef.current, {
                    type: recorder.mimeType || mimeType || 'audio/webm',
                });

                releaseTracks(recorder.stream);
                recorderRef.current = null;
                chunksRef.current = [];

                if (
                    !mountedRef.current ||
                    discardRef.current ||
                    blob.size === 0
                ) {
                    if (mountedRef.current) {
                        setDurationMs(finalDuration);
                        setStatus('idle');
                    }

                    return;
                }

                void Promise.resolve(
                    onRecordedRef.current({
                        blob,
                        durationMs: finalDuration,
                        mimeType: blob.type,
                    }),
                )
                    .then(() => {
                        if (mountedRef.current) {
                            setDurationMs(finalDuration);
                            setStatus('idle');
                        }
                    })
                    .catch(() => {
                        if (mountedRef.current) {
                            setStatus('error');
                            setError(
                                'Rekaman belum dapat disimpan. Jangan tutup halaman dan coba lagi.',
                            );
                        }
                    });
            };

            recorder.start(500);
            setStatus('recording');
            intervalRef.current = window.setInterval(() => {
                setDurationMs(
                    Math.min(
                        Date.now() - startedAtRef.current,
                        MAX_RECORDING_DURATION_MS,
                    ),
                );
            }, 250);
            timeoutRef.current = window.setTimeout(
                stop,
                MAX_RECORDING_DURATION_MS,
            );
        } catch (recordingError) {
            releaseTracks(stream);
            recorderRef.current = null;
            setStatus('error');
            setError(getPermissionError(recordingError));
        }
    }, [clearTimers, releaseTracks, status, stop]);

    const cancel = useCallback(() => {
        discardRef.current = true;
        stop();
    }, [stop]);

    const resetError = useCallback(() => {
        setError(null);
        setStatus('idle');
    }, []);

    useEffect(() => {
        mountedRef.current = true;

        return () => {
            mountedRef.current = false;
            discardRef.current = true;
            clearTimers();

            if (recorderRef.current?.state === 'recording') {
                recorderRef.current.stop();
            }

            releaseTracks();
        };
    }, [clearTimers, releaseTracks]);

    return {
        status,
        durationMs,
        error,
        maxDurationMs: MAX_RECORDING_DURATION_MS,
        isRecording: status === 'recording',
        start,
        stop,
        cancel,
        resetError,
    };
}
