import {
    AlertTriangle,
    CheckCircle2,
    Clock3,
    CloudOff,
    LoaderCircle,
    RotateCcw,
    Trash2,
    Volume2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useObjectUrl } from '@/hooks/use-object-url';
import { formatRupiah } from '@/lib/currency';
import type { VoiceNote, VoiceQueueStatus } from '@/types';

type VoiceNoteCardProps = {
    note: VoiceNote;
    isOnline: boolean;
    onReview: (note: VoiceNote) => void;
    onRetry: (id: string) => void;
    onRemove: (id: string) => void;
};

const statusDetails: Record<
    VoiceQueueStatus,
    { label: string; className: string; icon: typeof Clock3 }
> = {
    queued: {
        label: 'Dalam antrean',
        className:
            'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-200',
        icon: Clock3,
    },
    waiting_network: {
        label: 'Menunggu online',
        className:
            'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
        icon: CloudOff,
    },
    uploading: {
        label: 'Mengunggah',
        className: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200',
        icon: LoaderCircle,
    },
    processing: {
        label: 'Diproses AI',
        className: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200',
        icon: LoaderCircle,
    },
    ready: {
        label: 'Siap ditinjau',
        className:
            'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
        icon: CheckCircle2,
    },
    needs_review: {
        label: 'Perlu diperiksa',
        className:
            'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
        icon: AlertTriangle,
    },
    failed: {
        label: 'Gagal diproses',
        className: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200',
        icon: AlertTriangle,
    },
};

function VoiceAudio({ note }: { note: VoiceNote }) {
    const source = useObjectUrl(note.audio);

    return (
        <div className="grid min-w-0 gap-2 rounded-xl bg-muted/70 p-3">
            <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Volume2 className="size-4" /> Rekaman asli
            </span>
            <audio
                controls
                preload="metadata"
                src={source}
                className="h-10 w-full max-w-full"
            />
        </div>
    );
}

export function VoiceNoteCard({
    note,
    isOnline,
    onReview,
    onRetry,
    onRemove,
}: VoiceNoteCardProps) {
    const detail = statusDetails[note.status];
    const StatusIcon = detail.icon;
    const canReview = ['ready', 'needs_review'].includes(note.status);
    const canRetry = ['failed', 'waiting_network'].includes(note.status);

    const removeWithConfirmation = () => {
        if (
            window.confirm(
                'Hapus rekaman ini? Rekaman yang dihapus tidak dapat dipulihkan.',
            )
        ) {
            onRemove(note.id);
        }
    };

    return (
        <article className="grid min-w-0 gap-3 rounded-2xl border bg-card p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                    <p className="text-sm font-semibold">
                        Catatan{' '}
                        {new Intl.DateTimeFormat('id-ID', {
                            hour: '2-digit',
                            minute: '2-digit',
                        }).format(new Date(note.createdAt))}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                        {Math.max(1, Math.round(note.durationMs / 1000))} detik
                        · percobaan {note.attempts}
                    </p>
                </div>
                <span
                    className={`inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold ${detail.className}`}
                >
                    <StatusIcon
                        className={`size-3.5 ${
                            ['uploading', 'processing'].includes(note.status)
                                ? 'animate-spin'
                                : ''
                        }`}
                    />
                    {detail.label}
                </span>
            </div>

            {note.result?.transcript && (
                <blockquote className="line-clamp-2 border-l-2 border-primary/30 pl-3 text-sm text-muted-foreground italic">
                    “{note.result.transcript}”
                </blockquote>
            )}

            {note.result && (
                <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-muted-foreground">
                        {note.result.items.length} item · keyakinan{' '}
                        {Math.round(note.result.confidence * 100)}%
                    </span>
                    <span className="shrink-0 font-bold text-primary tabular-nums">
                        {formatRupiah(note.result.total_amount)}
                    </span>
                </div>
            )}

            {note.error && (
                <p className="rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    {note.error}
                </p>
            )}

            <VoiceAudio note={note} />

            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                {canReview ? (
                    <Button
                        type="button"
                        className="min-h-12 rounded-xl"
                        onClick={() => onReview(note)}
                    >
                        <CheckCircle2 /> Tinjau transaksi
                    </Button>
                ) : canRetry ? (
                    <Button
                        type="button"
                        variant="outline"
                        className="min-h-12 rounded-xl"
                        disabled={!isOnline}
                        onClick={() => onRetry(note.id)}
                    >
                        <RotateCcw /> Coba lagi
                    </Button>
                ) : (
                    <div className="flex min-h-12 items-center text-xs text-muted-foreground">
                        Rekam catatan berikutnya sambil menunggu.
                    </div>
                )}
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-12 rounded-xl text-muted-foreground hover:text-destructive"
                    onClick={removeWithConfirmation}
                    aria-label="Hapus catatan suara"
                    disabled={['uploading', 'processing'].includes(note.status)}
                >
                    <Trash2 />
                </Button>
            </div>
        </article>
    );
}
