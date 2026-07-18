import { Head, router } from '@inertiajs/react';
import {
    BookOpenCheck,
    CalendarDays,
    CheckCircle2,
    Clock3,
    Store,
    UserRound,
    WalletCards,
} from 'lucide-react';
import { formatRupiah } from '@/lib/money';
import { index as debtIndex } from '@/routes/debts';
import type { Debt, DebtStatus, Outlet } from '@/types';

type DebtsIndexProps = {
    outlets: Outlet[];
    selectedOutlet: Outlet | null;
    debts: Debt[];
    summary: {
        outstanding_amount: number;
        unpaid_count: number;
        paid_count: number;
    };
};

const statusDetails: Record<
    DebtStatus,
    { label: string; className: string; icon: typeof Clock3 }
> = {
    unpaid: {
        label: 'Belum dibayar',
        className: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200',
        icon: Clock3,
    },
    partially_paid: {
        label: 'Sebagian',
        className:
            'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
        icon: WalletCards,
    },
    paid: {
        label: 'Lunas',
        className:
            'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
        icon: CheckCircle2,
    },
};

function remainingDebt(debt: Debt): number {
    return debt.remaining_amount ?? Math.max(0, debt.amount - debt.paid_amount);
}

function formatDebtDate(date: string): string {
    return new Intl.DateTimeFormat('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    }).format(new Date(date));
}

const unknownStatusDetails = {
    label: 'Tidak diketahui',
    className: 'bg-muted text-muted-foreground',
    icon: Clock3,
};

function DebtStatusBadge({ status }: { status: string }) {
    const detail = statusDetails[status as DebtStatus] ?? unknownStatusDetails;
    const Icon = detail.icon;

    return (
        <span
            className={`inline-flex min-h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold ${detail.className}`}
        >
            <Icon className="size-3.5" />
            {detail.label}
        </span>
    );
}

export default function DebtsIndex({
    outlets,
    selectedOutlet,
    debts,
    summary,
}: DebtsIndexProps) {
    const changeOutlet = (value: string) => {
        router.visit(
            value === 'all'
                ? debtIndex()
                : debtIndex({ query: { outlet_id: Number(value) } }),
        );
    };

    return (
        <>
            <Head title="Bon Pelanggan" />
            <main className="flex h-full flex-1 flex-col gap-6 p-4 sm:p-6">
                <section className="overflow-hidden rounded-3xl border bg-card shadow-sm">
                    <div className="flex flex-col gap-5 bg-primary px-5 py-6 text-primary-foreground sm:flex-row sm:items-end sm:justify-between sm:px-7">
                        <div>
                            <p className="text-xs font-semibold tracking-[0.18em] text-white/70 uppercase">
                                Amanah Bon
                            </p>
                            <h1 className="mt-1 text-3xl font-bold">
                                Piutang pelanggan
                            </h1>
                            <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/75">
                                Pantau pembayaran bon dengan jelas untuk setiap
                                outlet.
                            </p>
                        </div>
                        <label className="grid gap-1 text-xs font-semibold text-white/75">
                            Tampilkan outlet
                            <select
                                value={selectedOutlet?.id ?? 'all'}
                                onChange={(event) =>
                                    changeOutlet(event.target.value)
                                }
                                className="min-h-12 min-w-48 rounded-xl border border-white/20 bg-white/10 px-3 text-sm font-medium text-white outline-none focus:border-white/60 focus:ring-3 focus:ring-white/20 [&_option]:text-stone-900"
                            >
                                <option value="all">Semua outlet</option>
                                {outlets.map((outlet) => (
                                    <option key={outlet.id} value={outlet.id}>
                                        {outlet.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>

                    <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-3">
                        <div className="bg-card p-5">
                            <p className="text-sm text-muted-foreground">
                                Total belum tertagih
                            </p>
                            <p className="mt-1 text-2xl font-black text-amber-700 dark:text-amber-300">
                                {formatRupiah(summary.outstanding_amount)}
                            </p>
                        </div>
                        <div className="bg-card p-5">
                            <p className="text-sm text-muted-foreground">
                                Bon belum dibayar
                            </p>
                            <p className="mt-1 text-2xl font-black">
                                {summary.unpaid_count}
                            </p>
                        </div>
                        <div className="bg-card p-5">
                            <p className="text-sm text-muted-foreground">
                                Bon lunas
                            </p>
                            <p className="mt-1 text-2xl font-black text-emerald-700 dark:text-emerald-300">
                                {summary.paid_count}
                            </p>
                        </div>
                    </div>
                </section>

                {debts.length === 0 ? (
                    <section className="flex min-h-72 flex-col items-center justify-center rounded-3xl border border-dashed bg-card p-8 text-center">
                        <span className="flex size-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200">
                            <BookOpenCheck className="size-8" />
                        </span>
                        <h2 className="mt-5 text-xl font-bold">
                            Belum ada bon pelanggan
                        </h2>
                        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                            Transaksi yang belum lunas akan muncul otomatis di
                            halaman ini.
                        </p>
                    </section>
                ) : (
                    <section className="overflow-hidden rounded-3xl border bg-card shadow-sm">
                        <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
                            <div>
                                <p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">
                                    Daftar bon
                                </p>
                                <h2 className="font-bold">
                                    {debts.length} catatan pelanggan
                                </h2>
                            </div>
                            {selectedOutlet && (
                                <span className="inline-flex min-h-9 items-center gap-2 rounded-full bg-muted px-3 text-xs font-semibold">
                                    <Store className="size-3.5" />
                                    {selectedOutlet.name}
                                </span>
                            )}
                        </div>

                        <div className="grid gap-3 p-4 md:hidden">
                            {debts.map((debt) => (
                                <article
                                    key={debt.id}
                                    className="grid gap-4 rounded-2xl border p-4"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex min-w-0 items-center gap-3">
                                            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                                                <UserRound className="size-5" />
                                            </span>
                                            <div className="min-w-0">
                                                <h3 className="truncate font-bold">
                                                    {debt.customer_name}
                                                </h3>
                                                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                                                    <CalendarDays className="size-3" />
                                                    {formatDebtDate(
                                                        debt.incurred_at,
                                                    )}
                                                </p>
                                            </div>
                                        </div>
                                        <DebtStatusBadge status={debt.status} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 rounded-xl bg-muted/70 p-3 text-sm">
                                        <div>
                                            <p className="text-xs text-muted-foreground">
                                                Nilai bon
                                            </p>
                                            <p className="mt-1 font-semibold">
                                                {formatRupiah(debt.amount)}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground">
                                                Sisa
                                            </p>
                                            <p className="mt-1 font-bold text-amber-700 dark:text-amber-300">
                                                {formatRupiah(
                                                    remainingDebt(debt),
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                    {(debt.outlet?.name || debt.note) && (
                                        <p className="text-xs leading-relaxed text-muted-foreground">
                                            {debt.outlet?.name &&
                                                `${debt.outlet.name} · `}
                                            {debt.note || 'Tanpa catatan'}
                                        </p>
                                    )}
                                </article>
                            ))}
                        </div>

                        <div className="hidden overflow-x-auto md:block">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-muted/60 text-xs text-muted-foreground uppercase">
                                    <tr>
                                        <th className="px-5 py-4 font-semibold">
                                            Pelanggan
                                        </th>
                                        <th className="px-5 py-4 font-semibold">
                                            Outlet
                                        </th>
                                        <th className="px-5 py-4 font-semibold">
                                            Tanggal
                                        </th>
                                        <th className="px-5 py-4 text-right font-semibold">
                                            Nilai bon
                                        </th>
                                        <th className="px-5 py-4 text-right font-semibold">
                                            Sisa
                                        </th>
                                        <th className="px-5 py-4 font-semibold">
                                            Status
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {debts.map((debt) => (
                                        <tr
                                            key={debt.id}
                                            className="transition hover:bg-muted/40"
                                        >
                                            <td className="px-5 py-4">
                                                <p className="font-semibold">
                                                    {debt.customer_name}
                                                </p>
                                                {debt.note && (
                                                    <p className="mt-0.5 max-w-xs truncate text-xs text-muted-foreground">
                                                        {debt.note}
                                                    </p>
                                                )}
                                            </td>
                                            <td className="px-5 py-4 text-muted-foreground">
                                                {debt.outlet?.name ||
                                                    selectedOutlet?.name ||
                                                    '—'}
                                            </td>
                                            <td className="px-5 py-4 text-muted-foreground">
                                                {formatDebtDate(
                                                    debt.incurred_at,
                                                )}
                                            </td>
                                            <td className="px-5 py-4 text-right font-medium">
                                                {formatRupiah(debt.amount)}
                                            </td>
                                            <td className="px-5 py-4 text-right font-bold text-amber-700 dark:text-amber-300">
                                                {formatRupiah(
                                                    remainingDebt(debt),
                                                )}
                                            </td>
                                            <td className="px-5 py-4">
                                                <DebtStatusBadge
                                                    status={debt.status}
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                )}
            </main>
        </>
    );
}

DebtsIndex.layout = {
    breadcrumbs: [
        {
            title: 'Bon',
            href: debtIndex(),
        },
    ],
};
