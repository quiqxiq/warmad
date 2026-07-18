import {
    Apple,
    Beef,
    Coffee,
    Package,
    Shirt,
    ShoppingBasket,
    Sparkles,
    SprayCan,
    Wheat,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { createElement } from 'react';
import { formatRupiah } from '@/lib/currency';
import type { Category } from '@/types';

const categoryIcons: Record<string, LucideIcon> = {
    apple: Apple,
    beef: Beef,
    coffee: Coffee,
    package: Package,
    shirt: Shirt,
    basket: ShoppingBasket,
    shoppingbasket: ShoppingBasket,
    sparkles: Sparkles,
    spraycan: SprayCan,
    wheat: Wheat,
};

function getCategoryIcon(icon: string | null): LucideIcon {
    if (!icon) {
        return Package;
    }

    return categoryIcons[icon.toLowerCase().replace(/[^a-z]/g, '')] ?? Package;
}

export function CategoryButton({
    category,
    onSelect,
}: {
    category: Category;
    onSelect: (category: Category) => void;
}) {
    const icon = createElement(getCategoryIcon(category.icon), {
        className: 'size-5',
    });

    return (
        <button
            type="button"
            onClick={() => onSelect(category)}
            className="group flex min-h-28 min-w-0 flex-col items-start justify-between rounded-2xl border bg-card p-4 text-left shadow-sm transition hover:border-primary/40 hover:shadow-md active:scale-[0.98]"
        >
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
                {icon}
            </span>
            <span className="grid min-w-0 gap-0.5">
                <span className="line-clamp-2 font-semibold">
                    {category.name}
                </span>
                <span className="truncate text-sm text-muted-foreground tabular-nums">
                    {formatRupiah(category.default_price)}
                </span>
            </span>
        </button>
    );
}
