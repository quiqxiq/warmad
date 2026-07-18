import {
    AlertTriangle,
    Banknote,
    BookOpenCheck,
    CirclePause,
    LoaderCircle,
    Plus,
    ReceiptText,
    ShoppingCart,
    UserRound,
    Volume2,
} from 'lucide-react';
import { useMemo } from 'react';
import { TransactionItemRow } from '@/components/cashier/transaction-item-row';
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
import { useObjectUrl } from '@/hooks/use-object-url';
import { formatRupiah, getQuickTenderOptions } from '@/lib/currency';
import { createUuid } from '@/lib/uuid';
import type {
    CartItem,
    Category,
    PaymentMode,
    SaleDraft,
    VoiceNote,
} from '@/types';

type TransactionReviewSheetProps = {
    open: boolean;
    draft: SaleDraft | null;
    categories: Category[];
    voiceNote?: VoiceNote | null;
    isSubmitting: boolean;
    onOpenChange: (open: boolean) => void;
    onDraftChange: (draft: SaleDraft) => void;
    onConfirm: () => void | Promise<void>;
    onHold: () => void | Promise<void>;
};

const paymentModes: Array<{
    value: PaymentMode;
    label: string;
    description: string;
    icon: typeof Banknote;
}> = [
    {
        value: 'cash',
        label: 'Tunai',
        description: 'Bayar sekarang',
        icon: Banknote,
    },
    {
        value: 'debt',
        label: 'Bon',
        description: 'Penuh/sebagian',
        icon: BookOpenCheck,
    },
    {
        value: 'hold',
        label: 'Tahan',
        description: 'Lanjut nanti',
        icon: CirclePause,
    },
];

function VoiceReview({ note }: { note: VoiceNote }) {
    const source = useObjectUrl(note.audio);
    const result = note.result;

    return (
        <section className="grid min-w-0 gap-3 rounded-2xl bg-primary/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-sm font-semibold text-primary">
                    <Volume2 className="size-4" /> Catatan suara asli
                </p>
                {result && (
                    <span className="rounded-full bg-background px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                        Keyakinan {Math.round(result.confidence * 100)}%
                    </span>
                )}
            </div>
            <audio
                controls
                preload="metadata"
                src={source}
                className="h-10 w-full max-w-full"
            />
            {result?.transcript && (
                <div className="grid gap-1">
                    <p className="text-xs font-semibold text-muted-foreground">
                        Transkrip AI
                    </p>
                    <blockquote className="text-sm leading-relaxed text-muted-foreground italic">
                        “{result.transcript}”
                    </blockquote>
                </div>
            )}
            {result && result.warnings.length > 0 && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                    <p className="flex items-center gap-2 text-xs font-bold">
                        <AlertTriangle className="size-4" /> Peringatan AI
                    </p>
                    <ul className="mt-1 grid list-disc gap-1 pl-5 text-xs">
                        {result.warnings.map((warning, index) => (
                            <li key={`${warning}-${index}`}>{warning}</li>
                        ))}
                    </ul>
                </div>
            )}
        </section>
    );
}

function calculateTotal(items: CartItem[]): number {
    return items.reduce(
        (sum, item) => sum + item.quantity * item.unit_price,
        0,
    );
}

export function TransactionReviewSheet({
    open,
    draft,
    categories,
    voiceNote,
    isSubmitting,
    onOpenChange,
    onDraftChange,
    onConfirm,
    onHold,
}: TransactionReviewSheetProps) {
    const activeCategories = useMemo(
        () =>
            categories
                .filter((category) => category.is_active)
                .sort((left, right) => left.position - right.position),
        [categories],
    );
    const total = draft ? calculateTotal(draft.items) : 0;
    const paymentAmount = Math.max(0, draft?.paymentAmount ?? 0);
    const changeDue = Math.max(0, paymentAmount - total);
    const debtDue = Math.max(0, total - paymentAmount);
    const requiresCustomer =
        draft?.paymentMode === 'debt' ||
        (draft?.paymentMode !== 'hold' && debtDue > 0);
    const reviewItems =
        draft?.items.filter(
            (item) =>
                item.category_id === null ||
                item.needs_review ||
                (item.confidence !== undefined && item.confidence < 0.75),
        ) ?? [];
    const hasInvalidItems =
        !draft ||
        draft.items.length === 0 ||
        draft.items.some(
            (item) =>
                item.category_id === null ||
                !Number.isFinite(item.quantity) ||
                item.quantity <= 0 ||
                !Number.isFinite(item.unit_price) ||
                item.unit_price < 0,
        );
    const isCustomerMissing = requiresCustomer && !draft?.customerName.trim();
    const isPaymentUnknown =
        (draft?.paymentUnknown ?? false) && draft?.paymentMode !== 'hold';

    if (!draft) {
        return null;
    }

    const updateDraft = (changes: Partial<SaleDraft>) => {
        onDraftChange({ ...draft, ...changes });
    };

    const setItems = (items: CartItem[]) => {
        const nextTotal = calculateTotal(items);
        const followsExactTotal =
            draft.paymentMode === 'cash' && draft.paymentAmount === total;

        updateDraft({
            items,
            paymentAmount: followsExactTotal ? nextTotal : draft.paymentAmount,
        });
    };

    const updateItem = (itemId: string, changes: Partial<CartItem>) => {
        setItems(
            draft.items.map((item) =>
                item.id === itemId ? { ...item, ...changes } : item,
            ),
        );
    };

    const addItem = () => {
        const category = activeCategories[0];

        if (!category) {
            return;
        }

        setItems([
            ...draft.items,
            {
                id: createUuid(),
                category_id: category.id,
                name: category.name,
                quantity: 1,
                unit: 'item',
                unit_price: category.default_price,
            },
        ]);
    };

    const setPaymentMode = (paymentMode: PaymentMode) => {
        let nextPaymentAmount = paymentAmount;

        if (paymentMode === 'cash' && paymentAmount < total) {
            nextPaymentAmount = total;
        }

        if (paymentMode === 'debt' && paymentAmount >= total) {
            nextPaymentAmount = 0;
        }

        updateDraft({
            paymentMode,
            paymentAmount: nextPaymentAmount,
            paymentUnknown: false,
        });
    };

    const primaryLabel =
        draft.paymentMode === 'debt'
            ? paymentAmount > 0
                ? `Catat bon sisa ${formatRupiah(debtDue)}`
                : `Catat bon ${formatRupiah(total)}`
            : debtDue > 0
              ? `Simpan & catat sisa ${formatRupiah(debtDue)}`
              : changeDue > 0
                ? `Simpan · kembali ${formatRupiah(changeDue)}`
                : 'Simpan transaksi';

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="bottom"
                className="cashier-review h-[calc(100dvh-0.5rem)] max-h-[calc(100dvh-0.5rem)] w-full max-w-none gap-0 overflow-hidden rounded-t-3xl p-0 sm:inset-x-auto sm:inset-y-0 sm:right-0 sm:h-full sm:max-h-none sm:max-w-2xl sm:rounded-none sm:border-t-0 sm:border-l"
            >
                <SheetHeader className="shrink-0 border-b px-5 py-4 pr-16 sm:px-6">
                    <div className="flex items-center gap-3">
                        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                            <ReceiptText className="size-5" />
                        </span>
                        <div className="min-w-0">
                            <SheetTitle className="text-xl">
                                Tinjau transaksi
                            </SheetTitle>
                            <SheetDescription>
                                Periksa item dan pembayaran sebelum menyimpan.
                            </SheetDescription>
                        </div>
                    </div>
                </SheetHeader>

                <div className="grid min-h-0 flex-1 gap-5 overflow-x-hidden overflow-y-auto px-4 py-5 sm:px-6">
                    {reviewItems.length > 0 && (
                        <div className="flex gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100">
                            <AlertTriangle className="mt-0.5 size-5 shrink-0" />
                            <div>
                                <p className="font-semibold">
                                    {reviewItems.length} item perlu diperiksa
                                </p>
                                <p className="mt-0.5 text-sm opacity-80">
                                    Pastikan kategori, jumlah, dan harga sudah
                                    benar. Kategori yang belum dikenali wajib
                                    dipilih.
                                </p>
                            </div>
                        </div>
                    )}

                    {voiceNote && <VoiceReview note={voiceNote} />}

                    <section
                        className="grid min-w-0 gap-3"
                        aria-labelledby="items-heading"
                    >
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">
                                    Rincian
                                </p>
                                <h3 id="items-heading" className="font-bold">
                                    {draft.items.length} item penjualan
                                </h3>
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                className="min-h-12 rounded-xl"
                                onClick={addItem}
                                disabled={activeCategories.length === 0}
                            >
                                <Plus /> Tambah
                            </Button>
                        </div>

                        <div className="grid min-w-0 gap-3">
                            {draft.items.map((item, index) => (
                                <TransactionItemRow
                                    key={item.id}
                                    item={item}
                                    index={index}
                                    categories={activeCategories}
                                    onChange={(changes) =>
                                        updateItem(item.id, changes)
                                    }
                                    onRemove={() =>
                                        setItems(
                                            draft.items.filter(
                                                (candidate) =>
                                                    candidate.id !== item.id,
                                            ),
                                        )
                                    }
                                />
                            ))}
                        </div>
                    </section>

                    <section
                        className="grid gap-3"
                        aria-labelledby="payment-heading"
                    >
                        <div>
                            <p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">
                                Pembayaran
                            </p>
                            <h3 id="payment-heading" className="font-bold">
                                Pilih cara bayar
                            </h3>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                            {paymentModes.map((mode) => {
                                const Icon = mode.icon;
                                const isSelected =
                                    draft.paymentMode === mode.value;

                                return (
                                    <button
                                        key={mode.value}
                                        type="button"
                                        onClick={() =>
                                            setPaymentMode(mode.value)
                                        }
                                        className={`flex min-h-20 min-w-0 flex-col items-center justify-center rounded-2xl border px-1 py-3 text-center transition ${
                                            isSelected
                                                ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                                                : 'bg-card hover:border-primary/40'
                                        }`}
                                    >
                                        <Icon className="size-5" />
                                        <span className="mt-1 text-sm font-bold">
                                            {mode.label}
                                        </span>
                                        <span
                                            className={`truncate text-[10px] ${
                                                isSelected
                                                    ? 'text-white/75'
                                                    : 'text-muted-foreground'
                                            }`}
                                        >
                                            {mode.description}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        {draft.paymentMode !== 'hold' && (
                            <div className="grid gap-4 rounded-2xl border bg-card p-4">
                                <div className="grid gap-1.5">
                                    <Label htmlFor="payment-amount">
                                        {draft.paymentMode === 'debt'
                                            ? 'Uang muka diterima'
                                            : 'Uang diterima'}
                                    </Label>
                                    <Input
                                        id="payment-amount"
                                        type="number"
                                        inputMode="numeric"
                                        min="0"
                                        step="100"
                                        value={draft.paymentAmount}
                                        onChange={(event) =>
                                            updateDraft({
                                                paymentAmount: Number(
                                                    event.target.value,
                                                ),
                                                paymentUnknown: false,
                                            })
                                        }
                                        className="min-h-14 rounded-xl text-lg font-bold tabular-nums"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                                    {getQuickTenderOptions(total).map(
                                        (option, index) => (
                                            <Button
                                                key={`${option.label}-${index}`}
                                                type="button"
                                                variant="outline"
                                                className="min-h-12 min-w-0 rounded-xl px-2 text-xs"
                                                onClick={() =>
                                                    updateDraft({
                                                        paymentAmount:
                                                            option.amount,
                                                    })
                                                }
                                            >
                                                {option.label}
                                            </Button>
                                        ),
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="min-w-0 rounded-xl bg-muted p-3">
                                        <p className="text-xs text-muted-foreground">
                                            Kembalian
                                        </p>
                                        <p className="mt-1 truncate font-bold text-emerald-700 tabular-nums dark:text-emerald-300">
                                            {formatRupiah(changeDue)}
                                        </p>
                                    </div>
                                    <div className="min-w-0 rounded-xl bg-muted p-3">
                                        <p className="text-xs text-muted-foreground">
                                            Sisa bon
                                        </p>
                                        <p className="mt-1 truncate font-bold text-amber-700 tabular-nums dark:text-amber-300">
                                            {formatRupiah(debtDue)}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </section>

                    {(requiresCustomer || draft.customerName) && (
                        <div className="grid gap-1.5">
                            <Label htmlFor="customer-name">
                                Nama pelanggan{' '}
                                {requiresCustomer && (
                                    <span className="text-destructive">*</span>
                                )}
                            </Label>
                            <div className="relative">
                                <UserRound className="absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    id="customer-name"
                                    value={draft.customerName}
                                    onChange={(event) =>
                                        updateDraft({
                                            customerName: event.target.value,
                                        })
                                    }
                                    placeholder="Contoh: Bu Siti"
                                    className="min-h-12 rounded-xl pl-12"
                                    aria-invalid={isCustomerMissing}
                                />
                            </div>
                            {isCustomerMissing && (
                                <p className="text-xs font-medium text-destructive">
                                    Nama pelanggan wajib untuk bon penuh atau
                                    sebagian.
                                </p>
                            )}
                        </div>
                    )}

                    <div className="grid gap-1.5">
                        <Label htmlFor="sale-note">Catatan (opsional)</Label>
                        <textarea
                            id="sale-note"
                            value={draft.note}
                            onChange={(event) =>
                                updateDraft({ note: event.target.value })
                            }
                            placeholder="Tambahkan keterangan transaksi"
                            maxLength={255}
                            className="min-h-24 resize-none rounded-xl border bg-background px-3 py-3 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/30"
                        />
                    </div>
                </div>

                <SheetFooter className="shrink-0 gap-3 border-t bg-background px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
                    <div className="flex items-center justify-between gap-4 rounded-2xl bg-muted px-4 py-3">
                        <div className="min-w-0">
                            <p className="text-xs text-muted-foreground">
                                Total transaksi
                            </p>
                            <p className="truncate text-xl font-black text-primary tabular-nums">
                                {formatRupiah(total)}
                            </p>
                        </div>
                        <ShoppingCart className="size-6 shrink-0 text-muted-foreground" />
                    </div>

                    {draft.paymentMode === 'hold' ? (
                        <Button
                            type="button"
                            size="lg"
                            className="min-h-14 rounded-xl text-base"
                            disabled={draft.items.length === 0 || isSubmitting}
                            onClick={() => void onHold()}
                        >
                            {isSubmitting ? (
                                <LoaderCircle className="animate-spin" />
                            ) : (
                                <CirclePause />
                            )}
                            {isSubmitting ? 'Menyimpan…' : 'Simpan dan tahan'}
                        </Button>
                    ) : (
                        <>
                            {hasInvalidItems && (
                                <p className="flex items-center gap-2 text-xs font-semibold text-destructive">
                                    <AlertTriangle className="size-4" />{' '}
                                    Lengkapi semua kategori, jumlah, dan harga.
                                </p>
                            )}
                            {isPaymentUnknown && (
                                <p className="flex items-center gap-2 text-xs font-semibold text-destructive">
                                    <AlertTriangle className="size-4" /> Jumlah
                                    pembayaran tidak terdengar. Konfirmasi uang
                                    diterima sebelum menyimpan.
                                </p>
                            )}
                            <Button
                                type="button"
                                size="lg"
                                className="min-h-14 rounded-xl text-base"
                                disabled={
                                    hasInvalidItems ||
                                    isCustomerMissing ||
                                    isPaymentUnknown ||
                                    isSubmitting
                                }
                                onClick={() => void onConfirm()}
                            >
                                {isSubmitting ? (
                                    <LoaderCircle className="animate-spin" />
                                ) : (
                                    <ReceiptText />
                                )}
                                {isSubmitting ? 'Menyimpan…' : primaryLabel}
                            </Button>
                        </>
                    )}
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}
