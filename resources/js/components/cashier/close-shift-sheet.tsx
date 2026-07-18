import {
    AlertTriangle,
    Coins,
    LoaderCircle,
    Scale,
    WalletCards,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { formatRupiah } from '@/lib/currency';
import type { Shift } from '@/types';

// Mirrors the backend AUTO_APPROVE_TOLERANCE: differences within this band are
// auto-approved, beyond it the cashier must explain the gap on the spot.
const AUTO_APPROVE_TOLERANCE = 10_000;

type CloseShiftSheetProps = {
    open: boolean;
    shift: Shift;
    /**
     * Best local estimate of cash that should be in the drawer (opening cash +
     * synced sales). The server recomputes authoritatively from persisted
     * transactions and debt payments, so this is guidance, not the final word.
     */
    expectedCashEstimate: number;
    pendingSalesCount: number;
    isSubmitting: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (input: { actualCash: number; note: string }) => void | Promise<void>;
};

export function CloseShiftSheet({
    open,
    shift,
    expectedCashEstimate,
    pendingSalesCount,
    isSubmitting,
    onOpenChange,
    onSubmit,
}: CloseShiftSheetProps) {
    const [actualCashInput, setActualCashInput] = useState('');
    const [note, setNote] = useState('');

    const handleOpenChange = (next: boolean) => {
        if (!next) {
            setActualCashInput('');
            setNote('');
        }

        onOpenChange(next);
    };

    const actualCash = useMemo(() => {
        const parsed = Number(actualCashInput);

        return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : 0;
    }, [actualCashInput]);

    const hasActualCash = actualCashInput.trim() !== '';
    const difference = actualCash - expectedCashEstimate;
    const withinTolerance = Math.abs(difference) <= AUTO_APPROVE_TOLERANCE;
    const noteRequired = hasActualCash && !withinTolerance;
    const noteMissing = noteRequired && note.trim() === '';
    const hasPendingSales = pendingSalesCount > 0;

    const differenceTone =
        difference === 0
            ? 'text-muted-foreground'
            : difference > 0
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-destructive';

    return (
        <Sheet open={open} onOpenChange={handleOpenChange}>
            <SheetContent
                side="bottom"
                className="flex h-auto max-h-[calc(100dvh-0.5rem)] w-full max-w-none flex-col gap-0 overflow-hidden rounded-t-3xl p-0 sm:inset-x-auto sm:inset-y-0 sm:right-0 sm:h-full sm:max-h-none sm:max-w-md sm:rounded-none sm:border-t-0 sm:border-l"
            >
                <SheetHeader className="shrink-0 border-b px-5 py-4 pr-16 sm:px-6">
                    <div className="flex items-center gap-3">
                        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                            <Scale className="size-5" />
                        </span>
                        <div className="min-w-0">
                            <SheetTitle className="text-xl">
                                Tutup kas shift
                            </SheetTitle>
                            <SheetDescription>
                                Hitung uang laci lalu cocokkan dengan sistem.
                            </SheetDescription>
                        </div>
                    </div>
                </SheetHeader>

                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4 sm:px-6">
                    {hasPendingSales && (
                        <p className="flex items-start gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-xs font-medium text-amber-900 dark:bg-amber-950/60 dark:text-amber-100">
                            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                            {pendingSalesCount} transaksi belum tersinkron. Tutup
                            kas akan diproses otomatis setelah semuanya terkirim,
                            jadi kas sistem masih bisa berubah.
                        </p>
                    )}

                    <div className="grid gap-3 rounded-2xl border bg-card p-4">
                        <div className="flex items-center justify-between gap-3 text-sm">
                            <span className="flex items-center gap-2 text-muted-foreground">
                                <WalletCards className="size-4" /> Kas awal
                            </span>
                            <span className="font-semibold tabular-nums">
                                {formatRupiah(shift.opening_cash)}
                            </span>
                        </div>
                        <div className="flex items-center justify-between gap-3 text-sm">
                            <span className="flex items-center gap-2 text-muted-foreground">
                                <Coins className="size-4" /> Perkiraan kas sistem
                            </span>
                            <span className="font-semibold tabular-nums">
                                {formatRupiah(expectedCashEstimate)}
                            </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                            Angka final dihitung server dari transaksi dan
                            pembayaran bon yang tersimpan.
                        </p>
                    </div>

                    <div className="grid gap-1.5">
                        <Label htmlFor="actual-cash">Kas fisik dihitung</Label>
                        <Input
                            id="actual-cash"
                            type="number"
                            inputMode="numeric"
                            min="0"
                            step="1000"
                            value={actualCashInput}
                            onChange={(event) =>
                                setActualCashInput(event.target.value)
                            }
                            placeholder="0"
                            className="min-h-14 rounded-xl text-lg font-bold tabular-nums"
                        />
                    </div>

                    {hasActualCash && (
                        <div className="flex items-center justify-between gap-3 rounded-2xl bg-muted px-4 py-3">
                            <span className="text-sm text-muted-foreground">
                                Selisih
                            </span>
                            <span
                                className={`text-lg font-black tabular-nums ${differenceTone}`}
                            >
                                {difference > 0 ? '+' : ''}
                                {formatRupiah(difference)}
                            </span>
                        </div>
                    )}

                    <div className="grid gap-1.5">
                        <Label htmlFor="close-note">
                            Catatan{' '}
                            {noteRequired ? '(wajib untuk selisih besar)' : '(opsional)'}
                        </Label>
                        <textarea
                            id="close-note"
                            value={note}
                            onChange={(event) => setNote(event.target.value)}
                            placeholder={
                                noteRequired
                                    ? 'Jelaskan penyebab selisih kas'
                                    : 'Tambahkan keterangan tutup kas'
                            }
                            maxLength={1000}
                            className="min-h-24 resize-none rounded-xl border bg-background px-3 py-3 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/30"
                        />
                    </div>
                </div>

                <SheetFooter className="shrink-0 gap-3 border-t bg-background px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
                    {noteMissing && (
                        <p className="flex items-center gap-2 text-xs font-semibold text-destructive">
                            <AlertTriangle className="size-4" /> Catatan alasan
                            wajib diisi untuk selisih besar.
                        </p>
                    )}
                    <Button
                        type="button"
                        size="lg"
                        className="min-h-14 rounded-xl text-base"
                        disabled={!hasActualCash || noteMissing || isSubmitting}
                        onClick={() =>
                            void onSubmit({ actualCash, note: note.trim() })
                        }
                    >
                        {isSubmitting ? (
                            <LoaderCircle className="animate-spin" />
                        ) : (
                            <Scale />
                        )}
                        {isSubmitting ? 'Menutup…' : 'Tutup kas & akhiri shift'}
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}
