import { VoiceNoteCard } from '@/components/cashier/voice-note-card';
import type { VoiceNote } from '@/types';

type VoiceQueueProps = {
    notes: VoiceNote[];
    isOnline: boolean;
    onReview: (note: VoiceNote) => void;
    onRetry: (id: string) => void;
    onRemove: (id: string) => void;
};

export function VoiceQueue(props: VoiceQueueProps) {
    if (props.notes.length === 0) {
        return null;
    }

    return (
        <section aria-labelledby="voice-queue-heading" className="grid gap-3">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">
                        Antrean suara
                    </p>
                    <h2 id="voice-queue-heading" className="text-lg font-bold">
                        {props.notes.length} catatan tersimpan
                    </h2>
                </div>
                <p className="text-right text-xs text-muted-foreground">
                    Satu per satu di latar
                </p>
            </div>
            <div className="grid min-w-0 gap-3 lg:grid-cols-2">
                {props.notes.map((note) => (
                    <VoiceNoteCard key={note.id} {...props} note={note} />
                ))}
            </div>
        </section>
    );
}
