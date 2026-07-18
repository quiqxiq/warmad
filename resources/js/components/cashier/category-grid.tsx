import { Package } from 'lucide-react';
import { CategoryButton } from '@/components/cashier/category-button';
import type { Category } from '@/types';

type CategoryGridProps = {
    categories: Category[];
    onSelect: (category: Category) => void;
};

export function CategoryGrid({ categories, onSelect }: CategoryGridProps) {
    const activeCategories = categories
        .filter((category) => category.is_active)
        .sort((left, right) => left.position - right.position);

    if (activeCategories.length === 0) {
        return (
            <div className="rounded-3xl border border-dashed p-8 text-center">
                <Package className="mx-auto size-8 text-muted-foreground" />
                <p className="mt-3 font-semibold">Belum ada kategori aktif</p>
                <p className="mt-1 text-sm text-muted-foreground">
                    Minta pemilik menambahkan kategori untuk transaksi manual.
                </p>
            </div>
        );
    }

    return (
        <section aria-labelledby="category-heading" className="grid gap-3">
            <div className="flex items-end justify-between gap-3">
                <div>
                    <p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">
                        Input manual
                    </p>
                    <h2 id="category-heading" className="text-lg font-bold">
                        Pilih kategori
                    </h2>
                </div>
                <p className="text-xs text-muted-foreground">
                    Ketuk untuk jual
                </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {activeCategories.map((category) => (
                    <CategoryButton
                        key={category.id}
                        category={category}
                        onSelect={onSelect}
                    />
                ))}
            </div>
        </section>
    );
}
