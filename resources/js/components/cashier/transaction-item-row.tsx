import { AlertTriangle, Minus, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatRupiah } from '@/lib/currency';
import type { CartItem, Category } from '@/types';

type TransactionItemRowProps = {
    item: CartItem;
    index: number;
    categories: Category[];
    onChange: (changes: Partial<CartItem>) => void;
    onRemove: () => void;
};

export function TransactionItemRow({
    item,
    index,
    categories,
    onChange,
    onRemove,
}: TransactionItemRowProps) {
    const hasUnknownCategory = item.category_id === null;
    const hasLowConfidence =
        item.needs_review ||
        (item.confidence !== undefined && item.confidence < 0.75);

    const selectCategory = (categoryId: number) => {
        const category = categories.find(
            (candidate) => candidate.id === categoryId,
        );

        if (!category) {
            return;
        }

        onChange({
            category_id: category.id,
            name: category.name,
            unit_price:
                hasUnknownCategory && item.unit_price === 0
                    ? category.default_price
                    : item.unit_price,
            needs_review: false,
        });
    };

    return (
        <article
            className={`grid min-w-0 gap-4 rounded-2xl border p-4 ${
                hasUnknownCategory
                    ? 'border-destructive bg-destructive/5 ring-2 ring-destructive/15'
                    : hasLowConfidence
                      ? 'border-amber-300 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20'
                      : 'bg-card'
            }`}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-xs font-semibold text-muted-foreground">
                        Item {index + 1}
                    </p>
                    <p className="truncate font-bold">
                        {item.name || 'Belum dikenali'}
                    </p>
                    {hasUnknownCategory ? (
                        <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-destructive">
                            <AlertTriangle className="size-3.5" /> Kategori
                            wajib dipilih
                        </p>
                    ) : (
                        item.confidence !== undefined && (
                            <p className="text-xs text-muted-foreground">
                                Keyakinan AI {Math.round(item.confidence * 100)}
                                %
                            </p>
                        )
                    )}
                </div>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-12 rounded-xl text-muted-foreground hover:text-destructive"
                    onClick={onRemove}
                    aria-label={`Hapus ${item.name || `item ${index + 1}`}`}
                >
                    <Trash2 />
                </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm font-medium sm:col-span-2">
                    Kategori
                    <select
                        value={item.category_id ?? ''}
                        onChange={(event) =>
                            selectCategory(Number(event.target.value))
                        }
                        aria-invalid={hasUnknownCategory}
                        className="min-h-12 min-w-0 rounded-xl border bg-background px-3 outline-none focus:border-ring focus:ring-3 focus:ring-ring/30 aria-invalid:border-destructive"
                    >
                        <option value="" disabled>
                            Pilih kategori
                        </option>
                        {categories.map((category) => (
                            <option key={category.id} value={category.id}>
                                {category.name}
                            </option>
                        ))}
                    </select>
                </label>

                <div className="grid min-w-0 gap-1.5">
                    <Label htmlFor={`quantity-${item.id}`}>
                        Jumlah ({item.unit})
                    </Label>
                    <div className="grid grid-cols-[3rem_minmax(0,1fr)_3rem] overflow-hidden rounded-xl border bg-background">
                        <button
                            type="button"
                            className="flex min-h-12 items-center justify-center border-r hover:bg-muted"
                            onClick={() =>
                                onChange({
                                    quantity: Math.max(0.01, item.quantity - 1),
                                })
                            }
                            aria-label="Kurangi jumlah"
                        >
                            <Minus className="size-4" />
                        </button>
                        <input
                            id={`quantity-${item.id}`}
                            type="number"
                            inputMode="decimal"
                            min="0.01"
                            step="0.01"
                            value={item.quantity}
                            onChange={(event) =>
                                onChange({
                                    quantity: Number(event.target.value),
                                })
                            }
                            className="min-h-12 min-w-0 bg-transparent px-1 text-center font-semibold outline-none"
                        />
                        <button
                            type="button"
                            className="flex min-h-12 items-center justify-center border-l hover:bg-muted"
                            onClick={() =>
                                onChange({ quantity: item.quantity + 1 })
                            }
                            aria-label="Tambah jumlah"
                        >
                            <Plus className="size-4" />
                        </button>
                    </div>
                </div>

                <div className="grid min-w-0 gap-1.5">
                    <Label htmlFor={`price-${item.id}`}>Harga satuan</Label>
                    <Input
                        id={`price-${item.id}`}
                        type="number"
                        inputMode="numeric"
                        min="0"
                        step="100"
                        value={item.unit_price}
                        onChange={(event) =>
                            onChange({
                                unit_price: Number(event.target.value),
                            })
                        }
                        className="min-h-12 min-w-0 rounded-xl tabular-nums"
                    />
                </div>
            </div>

            <div className="flex items-center justify-between border-t pt-3 text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-bold tabular-nums">
                    {formatRupiah(item.quantity * item.unit_price)}
                </span>
            </div>
        </article>
    );
}
