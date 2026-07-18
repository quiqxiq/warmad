import { Link } from '@inertiajs/react';
import { Check, Sparkles } from 'lucide-react';

import { Reveal } from '@/components/landing/reveal';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { register } from '@/routes';

type Plan = {
    name: string;
    price: string;
    period: string;
    description: string;
    features: string[];
    cta: string;
    highlighted?: boolean;
};

const PLANS: Plan[] = [
    {
        name: 'Coba Dulu',
        price: 'Gratis',
        period: 'selamanya',
        description: 'Buat memulai satu warung dan merasakan alurnya.',
        features: [
            '1 outlet',
            'Transaksi harian & rekonsiliasi kas',
            'Login penjaga via OTP',
            'Laporan harian dasar',
        ],
        cta: 'Mulai Gratis',
    },
    {
        name: 'Standar',
        price: 'Rp 49rb',
        period: '/outlet/bulan',
        description: 'Untuk juragan yang serius menjaga banyak warung.',
        features: [
            'Multi-outlet tanpa batas',
            'Serah terima dua pihak + foto',
            'Input suara (Voice Queue) + AI parser',
            'Laporan & broadcast WhatsApp',
            'Export PDF/Excel',
        ],
        cta: 'Pilih Standar',
        highlighted: true,
    },
    {
        name: 'Bisnis',
        price: 'Hubungi kami',
        period: '',
        description: 'Jaringan warung besar dengan kebutuhan khusus.',
        features: [
            'Semua di paket Standar',
            'Trust ledger & rating dua arah',
            'Marketplace pencarian penjaga',
            'Dukungan prioritas',
        ],
        cta: 'Hubungi Kami',
    },
];

export function LandingPricing() {
    return (
        <section id="harga" className="scroll-mt-20 py-20 sm:py-28">
            <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
                <div className="mx-auto max-w-2xl text-center">
                    <Reveal>
                        <span className="text-sm font-semibold text-primary">
                            Harga
                        </span>
                    </Reveal>
                    <Reveal delay={80}>
                        <h2 className="mt-3 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
                            Mulai gratis, bayar saat warung bertambah
                        </h2>
                    </Reveal>
                    <Reveal delay={160}>
                        <p className="mt-4 text-pretty text-muted-foreground">
                            Tanpa biaya hardware, tanpa kontrak jangka panjang.
                            Berhenti kapan saja.
                        </p>
                    </Reveal>
                </div>

                <div className="mt-14 grid grid-cols-1 items-stretch gap-6 lg:grid-cols-3">
                    {PLANS.map((plan, index) => (
                        <Reveal
                            key={plan.name}
                            delay={index * 100}
                            className="h-full"
                        >
                            <div
                                className={cn(
                                    'relative flex h-full flex-col rounded-3xl border p-7 transition-all duration-300',
                                    plan.highlighted
                                        ? 'border-primary/50 bg-card shadow-2xl shadow-primary/10 lg:-translate-y-3'
                                        : 'border-border/70 bg-card hover:-translate-y-1 hover:shadow-lg',
                                )}
                            >
                                {plan.highlighted ? (
                                    <span className="lp-shimmer absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-primary via-chart-1 to-primary bg-[length:200%_100%] px-3 py-1 text-xs font-semibold text-primary-foreground shadow">
                                        <span className="flex items-center gap-1">
                                            <Sparkles className="size-3" />
                                            Paling populer
                                        </span>
                                    </span>
                                ) : null}

                                <h3 className="text-lg font-semibold">
                                    {plan.name}
                                </h3>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    {plan.description}
                                </p>
                                <div className="mt-5 flex items-end gap-1">
                                    <span className="text-3xl font-bold tracking-tight">
                                        {plan.price}
                                    </span>
                                    {plan.period ? (
                                        <span className="pb-1 text-sm text-muted-foreground">
                                            {plan.period}
                                        </span>
                                    ) : null}
                                </div>

                                <ul className="mt-6 flex-1 space-y-3">
                                    {plan.features.map((feature) => (
                                        <li
                                            key={feature}
                                            className="flex items-start gap-2.5 text-sm"
                                        >
                                            <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                                            <span className="text-foreground/90">
                                                {feature}
                                            </span>
                                        </li>
                                    ))}
                                </ul>

                                <Button
                                    asChild
                                    className="mt-7 w-full"
                                    variant={
                                        plan.highlighted ? 'default' : 'outline'
                                    }
                                    size="lg"
                                >
                                    <Link href={register()}>{plan.cta}</Link>
                                </Button>
                            </div>
                        </Reveal>
                    ))}
                </div>
            </div>
        </section>
    );
}
