import { ArchiveRestore, PauseCircle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatRupiah } from '@/lib/money';
import type { HeldSale } from '@/types';

type HeldTransactionsProps = {
    sales: HeldSale[];
    onResume: (sale: HeldSale) => void;
    onRemove: (id: string) => void;
};

export function HeldTransactions({
    sales,
    onResume,
    onRemove,
}: HeldTransactionsProps) {
    if (sales.length === 0) {
        return null;
    }

    return (
        <section aria-labelledby="held-sales-heading" className="grid gap-3">
            <div>
                <p className="text-xs font-semibold tracking-[0.16em] text-amber-700 uppercase dark:text-amber-300">
                    Tersimpan lokal
                </p>
                <h2 id="held-sales-heading" className="text-lg font-bold">
                    Transaksi ditahan
                </h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
                {sales.map((sale) => {
                    const total = sale.draft.items.reduce(
                        (sum, item) => sum + item.quantity * item.unit_price,
                        0,
                    );

                    return (
                        <article
                            key={sale.id}
                            className="grid gap-3 rounded-2xl border border-amber-300/60 bg-amber-50/70 p-4 dark:border-amber-800 dark:bg-amber-950/30"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex gap-3">
                                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-100">
                                        <PauseCircle className="size-5" />
                                    </span>
                                    <div>
                                        <p className="font-semibold">
                                            {sale.draft.customerName ||
                                                'Tanpa nama pelanggan'}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {sale.draft.items.length} item ·{' '}
                                            {new Intl.DateTimeFormat('id-ID', {
                                                day: 'numeric',
                                                month: 'short',
                                                hour: '2-digit',
                                                minute: '2-digit',
                                            }).format(new Date(sale.updatedAt))}
                                        </p>
                                    </div>
                                </div>
                                <p className="font-bold text-amber-900 dark:text-amber-100">
                                    {formatRupiah(total)}
                                </p>
                            </div>
                            <div className="grid grid-cols-[1fr_auto] gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="min-h-12 rounded-xl bg-background"
                                    onClick={() => onResume(sale)}
                                >
                                    <ArchiveRestore /> Lanjutkan
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="size-12 rounded-xl text-muted-foreground hover:text-destructive"
                                    onClick={() => onRemove(sale.id)}
                                    aria-label="Hapus transaksi ditahan"
                                >
                                    <Trash2 />
                                </Button>
                            </div>
                        </article>
                    );
                })}
            </div>
        </section>
    );
}
