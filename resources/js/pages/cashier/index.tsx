import { Head, Link, router } from '@inertiajs/react';
import { MapPinOff, Store } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { store as storeShift } from '@/actions/App/Http/Controllers/Api/ShiftController';
import { index as outletIndex } from '@/actions/App/Http/Controllers/OutletController';
import { CashierHeader } from '@/components/cashier/cashier-header';
import { CategoryGrid } from '@/components/cashier/category-grid';
import { HeldSalesPanel } from '@/components/cashier/held-sales-panel';
import { StartShiftForm } from '@/components/cashier/start-shift-form';
import { TransactionReviewSheet } from '@/components/cashier/transaction-review-sheet';
import { VoiceQueue } from '@/components/cashier/voice-queue';
import { VoiceRecorder } from '@/components/cashier/voice-recorder';
import { Button } from '@/components/ui/button';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { useOfflineSales } from '@/hooks/use-offline-sales';
import { useVoiceQueue } from '@/hooks/use-voice-queue';
import { apiRequest, getRequestErrorMessage } from '@/lib/api';
import {
    deleteHeldSale,
    getHeldSales,
    OFFLINE_DATABASE_EVENT,
    OFFLINE_DATABASE_STORES,
    putHeldSale,
} from '@/lib/offline-database';
import { createUuid } from '@/lib/uuid';
import { index as cashierIndex } from '@/routes/cashier';
import type {
    BatchTransactionPayload,
    CashierPageProps,
    Category,
    HeldSale,
    SaleDraft,
    Shift,
    VoiceNote,
} from '@/types';

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

    const received = note.result.payment.received ?? note.result.total_amount;

    return {
        clientUuid: createUuid(),
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
        occurredAt: new Date().toISOString(),
        sourceVoiceNoteId: note.id,
    };
}

export default function CashierIndex({
    outlets,
    selectedOutlet,
    categories,
    activeShift,
    stats,
}: CashierPageProps) {
    const outletId = selectedOutlet?.id ?? null;
    const { isOnline } = useNetworkStatus();
    const voiceQueue = useVoiceQueue(outletId);
    const offlineSales = useOfflineSales(outletId ?? undefined);
    const [startedShift, setStartedShift] = useState<Shift | null>(null);
    const currentShift = startedShift ?? activeShift;
    const [heldSales, setHeldSales] = useState<HeldSale[]>([]);
    const [draft, setDraft] = useState<SaleDraft | null>(null);
    const [reviewOpen, setReviewOpen] = useState(false);
    const [activeHeldSaleId, setActiveHeldSaleId] = useState<string | null>(
        null,
    );
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isStartingShift, setIsStartingShift] = useState(false);
    const reportedStorageErrorRef = useRef<string | null>(null);

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
            setHeldSales(await getHeldSales(outletId));
        } catch (error) {
            const message = getRequestErrorMessage(error);

            if (reportedStorageErrorRef.current !== message) {
                reportedStorageErrorRef.current = message;
                toast.error(message);
            }
        }
    }, [outletId]);

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
            const response = await apiRequest<{ data?: Shift }>(storeShift(), {
                outlet_id: selectedOutlet.id,
                opening_cash: openingCash,
            });

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
        setDraft(createManualDraft(category));
        setActiveHeldSaleId(null);
        setReviewOpen(true);
    };

    const openVoiceReview = (note: VoiceNote) => {
        const voiceDraft = createVoiceDraft(note);

        if (!voiceDraft) {
            toast.error('Hasil suara belum siap ditinjau.');

            return;
        }

        setDraft(voiceDraft);
        setActiveHeldSaleId(null);
        setReviewOpen(true);
    };

    const resumeHeldSale = (sale: HeldSale) => {
        setDraft(sale.draft);
        setActiveHeldSaleId(sale.id);
        setReviewOpen(true);
    };

    const handleHold = async () => {
        if (!draft || !selectedOutlet || !currentShift) {
            return;
        }

        setIsSubmitting(true);

        try {
            const now = new Date().toISOString();
            const heldSale: HeldSale = {
                id: activeHeldSaleId ?? createUuid(),
                outletId: selectedOutlet.id,
                shiftId: currentShift.id,
                draft,
                createdAt:
                    heldSales.find((sale) => sale.id === activeHeldSaleId)
                        ?.createdAt ?? now,
                updatedAt: now,
            };

            await putHeldSale(heldSale);
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
        if (activeHeldSaleId) {
            await deleteHeldSale(activeHeldSaleId);
        }

        if (draft?.sourceVoiceNoteId) {
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
            outlet_id: selectedOutlet.id,
            shift_id: currentShift.id,
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
            await deleteHeldSale(id);
            toast.success('Transaksi ditahan dihapus.');
        } catch (error) {
            toast.error(getRequestErrorMessage(error));
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
                        await voiceQueue.enqueue(recording);
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

                <HeldSalesPanel
                    sales={heldSales}
                    onResume={resumeHeldSale}
                    onRemove={(id) => void handleRemoveHeldSale(id)}
                />

                <CategoryGrid
                    categories={categories}
                    onSelect={openManualReview}
                />
            </main>

            <TransactionReviewSheet
                open={reviewOpen}
                draft={draft}
                categories={categories}
                voiceNote={currentVoiceNote}
                isSubmitting={isSubmitting}
                onOpenChange={setReviewOpen}
                onDraftChange={setDraft}
                onConfirm={handleConfirm}
                onHold={handleHold}
            />
        </>
    );
}
