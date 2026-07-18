import { Clock3, MapPin, Store, WalletCards } from 'lucide-react';
import { formatCompactRupiah, formatRupiah } from '@/lib/currency';
import type { CashierStats, Outlet, Shift } from '@/types';

type CashierHeaderProps = {
    outlets: Outlet[];
    selectedOutlet: Outlet;
    activeShift: Shift;
    stats: CashierStats;
    onOutletChange: (outletId: number) => void;
};

type StatCardProps = {
    label: string;
    value: string;
    title?: string;
    tone: 'emerald' | 'amber' | 'neutral';
};

function StatCard({ label, value, title, tone }: StatCardProps) {
    const tones = {
        emerald:
            'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-100',
        amber: 'bg-amber-50 text-amber-950 dark:bg-amber-950/60 dark:text-amber-100',
        neutral: 'bg-muted text-foreground',
    };

    return (
        <div className={`min-w-0 rounded-2xl p-3 ${tones[tone]}`}>
            <p className="truncate text-[11px] font-medium opacity-70 sm:text-xs">
                {label}
            </p>
            <p
                className="mt-1 truncate text-base font-black tabular-nums sm:text-lg"
                title={title}
            >
                {value}
            </p>
        </div>
    );
}

export function CashierHeader({
    outlets,
    selectedOutlet,
    activeShift,
    stats,
    onOutletChange,
}: CashierHeaderProps) {
    return (
        <section className="grid gap-4 rounded-3xl border border-emerald-900/10 bg-card p-4 shadow-sm sm:p-5 dark:border-emerald-200/10">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
                        <Store className="size-6" />
                    </span>
                    <div className="min-w-0">
                        <p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">
                            Shift kasir aktif
                        </p>
                        <h1 className="truncate text-xl font-bold">
                            {selectedOutlet.name}
                        </h1>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                                <Clock3 className="size-3.5" />
                                Sejak{' '}
                                {new Intl.DateTimeFormat('id-ID', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                }).format(new Date(activeShift.started_at))}
                            </span>
                            <span className="inline-flex min-w-0 items-center gap-1 truncate">
                                <MapPin className="size-3.5 shrink-0" />
                                {selectedOutlet.address || 'Alamat belum diisi'}
                            </span>
                        </div>
                    </div>
                </div>

                {outlets.length > 1 && (
                    <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                        Ganti outlet
                        <select
                            value={selectedOutlet.id}
                            onChange={(event) =>
                                onOutletChange(Number(event.target.value))
                            }
                            className="min-h-12 rounded-xl border bg-background px-3 text-sm font-medium text-foreground outline-none focus:border-ring focus:ring-3 focus:ring-ring/30"
                        >
                            {outlets.map((outlet) => (
                                <option key={outlet.id} value={outlet.id}>
                                    {outlet.name}
                                </option>
                            ))}
                        </select>
                    </label>
                )}
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
                <StatCard
                    label="Total penjualan"
                    value={formatCompactRupiah(stats.total_sales)}
                    title={formatRupiah(stats.total_sales)}
                    tone="emerald"
                />
                <StatCard
                    label="Transaksi"
                    value={String(stats.transaction_count)}
                    tone="neutral"
                />
                <StatCard
                    label="Bon belum lunas"
                    value={formatCompactRupiah(stats.outstanding_debt_amount)}
                    title={formatRupiah(stats.outstanding_debt_amount)}
                    tone="amber"
                />
                <StatCard
                    label="Pelanggan berbon"
                    value={String(stats.outstanding_debt_count)}
                    tone="amber"
                />
            </div>

            <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <WalletCards className="size-4" />
                Kas awal {formatRupiah(activeShift.opening_cash)}
            </p>
        </section>
    );
}
