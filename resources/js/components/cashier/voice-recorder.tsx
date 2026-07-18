import { LoaderCircle, Mic, Square, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMediaRecorder } from '@/hooks/use-media-recorder';
import type { RecordedAudio } from '@/hooks/use-media-recorder';

type VoiceRecorderProps = {
    disabled?: boolean;
    onRecorded: (recording: RecordedAudio) => void | Promise<void>;
};

function formatDuration(durationMs: number): string {
    const totalSeconds = Math.floor(durationMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function VoiceRecorder({ disabled, onRecorded }: VoiceRecorderProps) {
    const {
        status,
        durationMs,
        error,
        maxDurationMs,
        isRecording,
        start,
        stop,
        cancel,
        resetError,
    } = useMediaRecorder({ onRecorded });
    const isBusy = status === 'requesting' || status === 'stopping';

    return (
        <section className="overflow-hidden rounded-3xl bg-primary px-5 py-6 text-primary-foreground shadow-lg shadow-primary/15 sm:px-7">
            <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
                <button
                    type="button"
                    disabled={disabled || isBusy}
                    onClick={isRecording ? stop : start}
                    aria-label={
                        isRecording
                            ? 'Selesai merekam'
                            : 'Mulai rekam transaksi'
                    }
                    className={`relative flex size-24 shrink-0 items-center justify-center rounded-full border-4 border-white/30 bg-white text-primary shadow-xl transition active:scale-95 disabled:opacity-60 ${
                        isRecording ? 'ring-4 ring-amber-300/70' : ''
                    }`}
                >
                    {isBusy ? (
                        <LoaderCircle className="size-9 animate-spin" />
                    ) : isRecording ? (
                        <Square className="size-8 fill-current" />
                    ) : (
                        <Mic className="size-10" />
                    )}
                    {isRecording && (
                        <span className="absolute top-1 right-1 size-3 rounded-full bg-red-500 ring-2 ring-white" />
                    )}
                </button>

                <div className="grid min-w-0 flex-1 gap-1">
                    <p className="text-xs font-semibold tracking-[0.18em] text-white/70 uppercase">
                        Kasir suara
                    </p>
                    <h2 className="text-2xl font-bold">
                        {isRecording
                            ? `Mendengarkan · ${formatDuration(durationMs)}`
                            : isBusy
                              ? 'Menyimpan rekaman…'
                              : 'Tekan, lalu sebutkan penjualan'}
                    </h2>
                    <p className="text-sm leading-relaxed text-white/75">
                        Contoh: “Dua kilo beras dua puluh ribu, dibayar lima
                        puluh ribu.” Maksimal {Math.round(maxDurationMs / 1000)}{' '}
                        detik dan langsung tersimpan di perangkat.
                    </p>
                    {isRecording && (
                        <div className="mt-2 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={stop}
                                className="min-h-12 rounded-xl"
                            >
                                <Square className="fill-current" /> Selesai
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={cancel}
                                className="min-h-12 rounded-xl text-white hover:bg-white/10 hover:text-white"
                            >
                                <X /> Batalkan
                            </Button>
                        </div>
                    )}
                    {error && (
                        <button
                            type="button"
                            onClick={resetError}
                            className="mt-2 min-h-12 rounded-xl bg-white/10 px-4 text-sm font-medium hover:bg-white/20"
                        >
                            {error} Ketuk untuk tutup.
                        </button>
                    )}
                </div>
            </div>
        </section>
    );
}
