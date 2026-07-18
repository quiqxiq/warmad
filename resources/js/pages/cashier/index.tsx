import { Head, Link, router, usePage } from '@inertiajs/react';
import { MapPinOff, Scale, Store } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { store as storeShift } from '@/actions/App/Http/Controllers/Api/ShiftController';
import { index as outletIndex } from '@/actions/App/Http/Controllers/OutletController';
import { CashierHeader } from '@/components/cashier/cashier-header';
import { CategoryGrid } from '@/components/cashier/category-grid';
import { CloseShiftSheet } from '@/components/cashier/close-shift-sheet';
import { HeldTransactions } from '@/components/cashier/held-transactions';
import { StartShiftForm } from '@/components/cashier/start-shift-form';
import { TransactionReviewSheet } from '@/components/cashier/transaction-review-sheet';
import { VoiceQueue } from '@/components/cashier/voice-queue';
import { VoiceRecorder } from '@/components/cashier/voice-recorder';
import { Button } from '@/components/ui/button';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { useOfflineReconciliations } from '@/hooks/use-offline-reconciliations';
import { useOfflineSales } from '@/hooks/use-offline-sales';
import { useVoiceQueue } from '@/hooks/use-voice-queue';
import { apiRequest, getRequestErrorMessage } from '@/lib/api';
import {
    claimVoiceNoteForSale,
    deleteHeldSale,
    getHeldSales,
    OFFLINE_DATABASE_EVENT,
    OFFLINE_DATABASE_STORES,
    putHeldSale,
    setVoiceNoteSaleState,
} from '@/lib/offline-database';
import { getOfflineOwner } from '@/lib/offline-owner';
import { createUuid } from '@/lib/uuid';
import { index as cashierIndex } from '@/routes/cashier';
import type {
    BatchTransactionPayload,
    CashierPageProps,
    Category,
    HeldSale,
    OfflineOwner,
    ReconciliationPayload,
    SaleDraft,
    Shift,
    VoiceNote,
} from '@/types';

type PendingShiftStart = {
    client_uuid: string;
    outlet_id: number;
    opening_cash: number;
    started_at: string;
};

const pendingShiftStorageKey = (owner: OfflineOwner, outletId: number) =>
    `warmad:pending-shift:${owner.tenantId}:${owner.userId}:${outletId}`;

function getPendingShiftStart(
    owner: OfflineOwner,
    outletId: number,
    openingCash: number,
): PendingShiftStart {
    const storageKey = pendingShiftStorageKey(owner, outletId);

    try {
        const stored = window.localStorage.getItem(storageKey);

        if (stored) {
            const pending = JSON.parse(stored) as Partial<PendingShiftStart>;

            if (
                pending.outlet_id === outletId &&
                typeof pending.client_uuid === 'string' &&
                typeof pending.opening_cash === 'number' &&
                typeof pending.started_at === 'string'
            ) {
                return pending as PendingShiftStart;
            }
        }
    } catch {
        window.localStorage.removeItem(storageKey);
    }

    const pending: PendingShiftStart = {
        client_uuid: createUuid(),
        outlet_id: outletId,
        opening_cash: openingCash,
        started_at: new Date().toISOString(),
    };

    window.localStorage.setItem(storageKey, JSON.stringify(pending));

    return pending;
}

function clearPendingShiftStart(
    owner: OfflineOwner,
    outletId: number,
    clientUuid: string,
) {
    const storageKey = pendingShiftStorageKey(owner, outletId);

    try {
        const stored = window.localStorage.getItem(storageKey);
        const pending = stored
            ? (JSON.parse(stored) as Partial<PendingShiftStart>)
            : null;

        if (pending?.client_uuid === clientUuid) {
            window.localStorage.removeItem(storageKey);
        }
    } catch {
        window.localStorage.removeItem(storageKey);
    }
}

function createManualDraft(category: Category): SaleDraft {
    return {
        clientUuid: createUuid(),
        items: [
            {
                id: createUuid(),
                category_id: category.id,
                name: category.name,
                quantity: 1,
                unit: 'item',
                unit_price: category.default_price,
            },
        ],
        inputMethod: 'manual',
        paymentMode: 'cash',
        paymentAmount: category.default_price,
        customerName: '',
        note: '',
        occurredAt: new Date().toISOString(),
    };
}

function createVoiceDraft(note: VoiceNote): SaleDraft | null {
    if (!note.result) {
        return null;
    }

    const paymentUnknown = note.result.payment.received === null;
    const received = note.result.payment.received ?? note.result.total_amount;

    return {
        // Stable per-note sale UUID prevents a reopened note from spawning a
        // second sale under a fresh identifier.
        clientUuid: note.saleUuid ?? note.id,
        items: note.result.items.map((item) => ({
            id: createUuid(),
            category_id: item.category_id,
            name: item.name,
            quantity: item.quantity,
            unit: item.unit,
            unit_price: item.unit_price,
            confidence: item.confidence,
            needs_review: item.needs_review,
        })),
        inputMethod: 'voice',
        paymentMode: received < note.result.total_amount ? 'debt' : 'cash',
        paymentAmount: Math.max(0, received),
        customerName: '',
        note: '',
        // Recording time, not review time, so the sale lands in the right period.
        occurredAt: note.createdAt,
        originOutletId: note.outletId,
        originShiftId: note.shiftId,
        sourceVoiceNoteId: note.id,
        paymentUnknown,
    };
}

export default function CashierIndex({
    outlets,
    selectedOutlet,
    categories,
    activeShift,
    stats,
}: CashierPageProps) {
    const { auth } = usePage().props;
    const offlineOwner = useMemo(() => getOfflineOwner(auth), [auth]);
    const outletId = selectedOutlet?.id ?? null;
    const { isOnline } = useNetworkStatus();
    const voiceQueue = useVoiceQueue(outletId);
    const offlineSales = useOfflineSales(outletId ?? undefined);
    const [startedShift, setStartedShift] = useState<Shift | null>(null);
    const currentShift = startedShift ?? activeShift;
    const offlineReconciliations = useOfflineReconciliations(currentShift?.id);
    const [heldSales, setHeldSales] = useState<HeldSale[]>([]);
    const [draft, setDraft] = useState<SaleDraft | null>(null);
    const [reviewOpen, setReviewOpen] = useState(false);
    const [activeHeldSaleId, setActiveHeldSaleId] = useState<string | null>(
        null,
    );
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isStartingShift, setIsStartingShift] = useState(false);
    const [closeShiftOpen, setCloseShiftOpen] = useState(false);
    const [isClosingShift, setIsClosingShift] = useState(false);
    const reportedStorageErrorRef = useRef<string | null>(null);
    // Set when a draft is held or submitted so closing the sheet doesn't release
    // the voice-note claim we intentionally kept (held) or consumed (submitted).
    const draftFinalizedRef = useRef(false);

    useEffect(() => {
        const storageError =
            voiceQueue.storageError ?? offlineSales.storageError;

        if (storageError && reportedStorageErrorRef.current !== storageError) {
            reportedStorageErrorRef.current = storageError;
            toast.error(storageError);
        }
    }, [offlineSales.storageError, voiceQueue.storageError]);

    const refreshHeldSales = useCallback(async () => {
        if (outletId === null) {
            setHeldSales([]);

            return;
        }

        try {
            setHeldSales(await getHeldSales(offlineOwner, outletId));
        } catch (error) {
            const message = getRequestErrorMessage(error);

            if (reportedStorageErrorRef.current !== message) {
                reportedStorageErrorRef.current = message;
                toast.error(message);
            }
        }
    }, [offlineOwner, outletId]);

    useEffect(() => {
        const initialRefresh = window.setTimeout(
            () => void refreshHeldSales(),
            0,
        );

        const handleStorageChange = (event: Event) => {
            const detail = (event as CustomEvent<{ store?: string }>).detail;

            if (
                !detail?.store ||
                detail.store === OFFLINE_DATABASE_STORES.heldSales
            ) {
                void refreshHeldSales();
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
    }, [refreshHeldSales]);

    const handleOutletChange = (newOutletId: number) => {
        router.visit(
            cashierIndex({
                query: { outlet_id: newOutletId },
            }),
            { preserveScroll: false },
        );
    };

    const handleStartShift = async (openingCash: number) => {
        if (!selectedOutlet) {
            return;
        }

        setIsStartingShift(true);

        try {
            const pendingShift = getPendingShiftStart(
                offlineOwner,
                selectedOutlet.id,
                openingCash,
            );
            const response = await apiRequest<{ data?: Shift }>(
                storeShift(),
                pendingShift,
            );

            clearPendingShiftStart(
                offlineOwner,
                selectedOutlet.id,
                pendingShift.client_uuid,
            );

            if (response?.data?.id) {
                setStartedShift(response.data);
            } else {
                router.reload({ only: ['activeShift', 'stats'] });
            }

            toast.success('Shift berhasil dibuka. Selamat bekerja!');
        } catch (error) {
            toast.error(getRequestErrorMessage(error));
        } finally {
            setIsStartingShift(false);
        }
    };

    const openManualReview = (category: Category) => {
        draftFinalizedRef.current = true;
        setDraft({
            ...createManualDraft(category),
            originOutletId: selectedOutlet?.id,
            originShiftId: currentShift?.id ?? null,
        });
        setActiveHeldSaleId(null);
        setReviewOpen(true);
    };

    const openVoiceReview = async (note: VoiceNote) => {
        if (!note.result) {
            toast.error('Hasil suara belum siap ditinjau.');

            return;
        }

        // Atomically claim the note so a reopen — in this tab or another — cannot
        // start a second draft for the same recording.
        const claimed = await claimVoiceNoteForSale(offlineOwner, note.id);

        if (!claimed) {
            toast.error(
                'Catatan suara ini sedang ditinjau atau sudah tersimpan.',
            );

            return;
        }

        const voiceDraft = createVoiceDraft(claimed);

        if (!voiceDraft) {
            // Release the claim so the note can be retried later.
            await setVoiceNoteSaleState(offlineOwner, note.id, 'open');
            toast.error('Hasil suara belum siap ditinjau.');

            return;
        }

        draftFinalizedRef.current = false;
        setDraft(voiceDraft);
        setActiveHeldSaleId(null);
        setReviewOpen(true);
    };

    const resumeHeldSale = (sale: HeldSale) => {
        draftFinalizedRef.current = true;
        setDraft(sale.draft);
        setActiveHeldSaleId(sale.id);
        setReviewOpen(true);
    };

    // Release a voice-note claim when the sheet closes without the sale being
    // held or submitted, returning the note to `open` for a later attempt.
    const handleReviewOpenChange = (open: boolean) => {
        if (
            !open &&
            !draftFinalizedRef.current &&
            draft?.sourceVoiceNoteId
        ) {
            void setVoiceNoteSaleState(
                offlineOwner,
                draft.sourceVoiceNoteId,
                'open',
            );
        }

        setReviewOpen(open);
    };

    const handleHold = async () => {
        if (!draft || !selectedOutlet || !currentShift) {
            return;
        }

        setIsSubmitting(true);

        try {
            const now = new Date().toISOString();
            // A held voice sale keeps its note `claimed`, so reopening it resumes
            // the same held draft rather than spawning a competing one.
            draftFinalizedRef.current = true;
            const heldSale: HeldSale = {
                id: activeHeldSaleId ?? createUuid(),
                outletId: draft.originOutletId ?? selectedOutlet.id,
                shiftId: draft.originShiftId ?? currentShift.id,
                draft,
                createdAt:
                    heldSales.find((sale) => sale.id === activeHeldSaleId)
                        ?.createdAt ?? now,
                updatedAt: now,
            };

            await putHeldSale(offlineOwner, heldSale);

            // The held sale now owns this recording (stable UUID + origin shift),
            // so retire the source note from the queue. It cannot be reviewed
            // again to produce a competing draft.
            if (draft.sourceVoiceNoteId) {
                await setVoiceNoteSaleState(
                    offlineOwner,
                    draft.sourceVoiceNoteId,
                    'consumed',
                );
                await voiceQueue.remove(draft.sourceVoiceNoteId);
            }

            setReviewOpen(false);
            setDraft(null);
            setActiveHeldSaleId(null);
            toast.success('Transaksi ditahan dan tersimpan di perangkat.');
        } catch (error) {
            toast.error(getRequestErrorMessage(error));
        } finally {
            setIsSubmitting(false);
        }
    };

    const completeLocalSale = async () => {
        draftFinalizedRef.current = true;

        if (activeHeldSaleId) {
            await deleteHeldSale(offlineOwner, activeHeldSaleId);
        }

        if (draft?.sourceVoiceNoteId) {
            // Mark consumed rather than deleting: the note becomes permanently
            // unclaimable so it can never produce a second sale, even from a
            // stale tab that still holds a reference to it.
            await setVoiceNoteSaleState(
                offlineOwner,
                draft.sourceVoiceNoteId,
                'consumed',
            );
            await voiceQueue.remove(draft.sourceVoiceNoteId);
        }

        setReviewOpen(false);
        setDraft(null);
        setActiveHeldSaleId(null);
    };

    const handleConfirm = async () => {
        if (!draft || !selectedOutlet || !currentShift) {
            return;
        }

        if (draft.items.some((item) => item.category_id === null)) {
            toast.error('Pilih kategori untuk semua item terlebih dahulu.');

            return;
        }

        if (draft.paymentUnknown && draft.paymentMode !== 'hold') {
            toast.error(
                'Konfirmasi jumlah pembayaran sebelum menyimpan transaksi.',
            );

            return;
        }

        const total = draft.items.reduce(
            (sum, item) => sum + item.quantity * item.unit_price,
            0,
        );
        const requiresCustomer =
            draft.paymentMode === 'debt' || draft.paymentAmount < total;

        if (requiresCustomer && !draft.customerName.trim()) {
            toast.error('Nama pelanggan wajib untuk transaksi bon.');

            return;
        }

        const payload: BatchTransactionPayload = {
            client_uuid: draft.clientUuid,
            // Attribute to the capture-time outlet/shift when known, so a sale
            // reviewed later is never misfiled against the current shift.
            outlet_id: draft.originOutletId ?? selectedOutlet.id,
            shift_id: draft.originShiftId ?? currentShift.id,
            items: draft.items.map((item) => ({
                category_id: item.category_id as number,
                quantity: item.quantity,
                unit_price: item.unit_price,
            })),
            payment_amount: Math.max(0, draft.paymentAmount),
            customer_name: draft.customerName.trim() || null,
            input_method: draft.inputMethod,
            note: draft.note.trim() || null,
            occurred_at: draft.occurredAt,
        };

        setIsSubmitting(true);

        try {
            const result = await offlineSales.submit(payload);

            await completeLocalSale();

            if (result === 'queued') {
                toast.success(
                    isOnline
                        ? 'Jaringan terputus. Transaksi aman di antrean sinkron.'
                        : 'Transaksi tersimpan offline dan akan dikirim otomatis.',
                );
            } else {
                toast.success('Transaksi berhasil disimpan.');
                router.reload({ only: ['stats'] });
            }
        } catch (error) {
            toast.error(getRequestErrorMessage(error));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRemoveHeldSale = async (id: string) => {
        try {
            await deleteHeldSale(offlineOwner, id);
            toast.success('Transaksi ditahan dihapus.');
        } catch (error) {
            toast.error(getRequestErrorMessage(error));
        }
    };

    // Local guidance only: opening cash plus the total sales the server has
    // already tallied for this shift. The server recomputes authoritatively on
    // close, so this figure just helps the cashier eyeball the drawer.
    const expectedCashEstimate =
        (currentShift?.opening_cash ?? 0) + stats.total_sales;

    const handleCloseShift = async ({
        actualCash,
        note,
    }: {
        actualCash: number;
        note: string;
    }) => {
        if (!currentShift || !selectedOutlet) {
            return;
        }

        const payload: ReconciliationPayload = {
            client_uuid: createUuid(),
            shift_id: currentShift.id,
            actual_cash: actualCash,
            note: note.trim() || null,
        };

        setIsClosingShift(true);

        try {
            const result = await offlineReconciliations.submit(
                payload,
                selectedOutlet.id,
            );

            setCloseShiftOpen(false);

            if (result === 'queued') {
                toast.success(
                    offlineSales.pendingCount > 0
                        ? 'Tutup kas antre — akan diproses setelah transaksi shift ini tersinkron.'
                        : 'Tutup kas tersimpan dan akan dikirim otomatis saat online.',
                );
            } else {
                toast.success('Kas berhasil ditutup dan shift diakhiri.');
                setStartedShift(null);
                router.reload();
            }
        } catch (error) {
            toast.error(getRequestErrorMessage(error));
        } finally {
            setIsClosingShift(false);
        }
    };

    const currentVoiceNote =
        voiceQueue.notes.find((note) => note.id === draft?.sourceVoiceNoteId) ??
        null;

    if (!selectedOutlet) {
        return (
            <>
                <Head title="Kasir" />
                <main className="mx-auto flex min-h-[calc(100dvh-10rem)] w-full max-w-xl items-center p-4">
                    <section className="w-full rounded-3xl border border-dashed bg-card p-6 text-center shadow-sm sm:p-8">
                        <span className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                            {outlets.length === 0 ? (
                                <Store className="size-8" />
                            ) : (
                                <MapPinOff className="size-8" />
                            )}
                        </span>
                        <h1 className="mt-5 text-2xl font-bold">
                            {outlets.length === 0
                                ? 'Belum ada outlet'
                                : 'Pilih outlet untuk mulai'}
                        </h1>
                        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
                            {outlets.length === 0
                                ? 'Buat outlet terlebih dahulu sebelum membuka kasir Amanah.'
                                : 'Pilih outlet aktif untuk membuka pengalaman kasir.'}
                        </p>

                        {outlets.length > 0 ? (
                            <div className="mt-6 grid gap-2">
                                {outlets
                                    .filter((outlet) => outlet.is_active)
                                    .map((outlet) => (
                                        <Button
                                            key={outlet.id}
                                            asChild
                                            variant="outline"
                                            className="min-h-12 rounded-xl"
                                        >
                                            <Link
                                                href={cashierIndex({
                                                    query: {
                                                        outlet_id: outlet.id,
                                                    },
                                                })}
                                            >
                                                <Store /> {outlet.name}
                                            </Link>
                                        </Button>
                                    ))}
                            </div>
                        ) : (
                            <Button
                                asChild
                                size="lg"
                                className="mt-6 min-h-12 rounded-xl"
                            >
                                <Link href={outletIndex()}>
                                    <Store /> Kelola outlet
                                </Link>
                            </Button>
                        )}
                    </section>
                </main>
            </>
        );
    }

    if (!currentShift) {
        return (
            <>
                <Head title="Mulai Shift Kasir" />
                <StartShiftForm
                    outlet={selectedOutlet}
                    isSubmitting={isStartingShift}
                    onSubmit={handleStartShift}
                />
            </>
        );
    }

    return (
        <>
            <Head title={`Kasir · ${selectedOutlet.name}`} />
            <main className="grid min-w-0 gap-6 px-4 py-5 pb-8 sm:px-6">
                <CashierHeader
                    outlets={outlets}
                    selectedOutlet={selectedOutlet}
                    activeShift={currentShift}
                    stats={stats}
                    onOutletChange={handleOutletChange}
                />

                <VoiceRecorder
                    onRecorded={async (recording) => {
                        await voiceQueue.enqueue({
                            ...recording,
                            shiftId: currentShift.id,
                        });
                        toast.success(
                            isOnline
                                ? 'Rekaman aman dan masuk antrean proses.'
                                : 'Rekaman tersimpan offline di perangkat.',
                        );
                    }}
                />

                <VoiceQueue
                    notes={voiceQueue.notes}
                    isOnline={isOnline}
                    onReview={openVoiceReview}
                    onRetry={(id) => void voiceQueue.retry(id)}
                    onRemove={(id) => void voiceQueue.remove(id)}
                />

                <HeldTransactions
                    sales={heldSales}
                    onResume={resumeHeldSale}
                    onRemove={(id) => void handleRemoveHeldSale(id)}
                />

                <CategoryGrid
                    categories={categories}
                    onSelect={openManualReview}
                />

                <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    className="min-h-14 rounded-xl border-destructive/30 text-base text-destructive hover:bg-destructive/5 hover:text-destructive"
                    onClick={() => setCloseShiftOpen(true)}
                >
                    <Scale />
                    Tutup kas & akhiri shift
                </Button>
            </main>

            <TransactionReviewSheet
                open={reviewOpen}
                draft={draft}
                categories={categories}
                voiceNote={currentVoiceNote}
                isSubmitting={isSubmitting}
                onOpenChange={handleReviewOpenChange}
                onDraftChange={setDraft}
                onConfirm={handleConfirm}
                onHold={handleHold}
            />

            <CloseShiftSheet
                open={closeShiftOpen}
                shift={currentShift}
                expectedCashEstimate={expectedCashEstimate}
                pendingSalesCount={offlineSales.pendingCount}
                isSubmitting={isClosingShift}
                onOpenChange={setCloseShiftOpen}
                onSubmit={handleCloseShift}
            />
        </>
    );
}
