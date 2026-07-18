import { Link } from '@inertiajs/react';
import {
    ArrowRight,
    CheckCircle2,
    MessageCircle,
    ShieldCheck,
} from 'lucide-react';

import { Reveal } from '@/components/landing/reveal';
import { Button } from '@/components/ui/button';
import { dashboard, login, register } from '@/routes';
import type { User } from '@/types/auth';

export function LandingHero({ user }: { user: User | null }) {
    return (
        <section className="relative overflow-hidden pt-32 pb-20 sm:pt-40 sm:pb-28">
            {/* Aurora / gradient backdrop */}
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
            >
                <div className="lp-aurora absolute -top-32 left-1/2 size-[38rem] -translate-x-1/2 rounded-full bg-primary/25 blur-3xl" />
                <div className="lp-aurora absolute top-20 -right-24 size-[28rem] rounded-full bg-chart-2/20 blur-3xl [animation-delay:-6s]" />
                <div className="lp-aurora absolute -bottom-24 -left-24 size-[26rem] rounded-full bg-accent/40 blur-3xl [animation-delay:-3s]" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,var(--color-background)_78%)]" />
            </div>

            <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:gap-8">
                <div className="text-center lg:text-left">
                    <Reveal>
                        <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/60 px-4 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur">
                            <span className="relative flex size-2">
                                <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-75" />
                                <span className="relative inline-flex size-2 rounded-full bg-primary" />
                            </span>
                            Untuk juragan & penjaga Warung Madura
                        </span>
                    </Reveal>

                    <Reveal delay={80}>
                        <h1 className="mt-6 text-4xl font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl">
                            Kelola warung tanpa{' '}
                            <span className="bg-gradient-to-r from-primary via-chart-1 to-chart-2 bg-clip-text text-transparent">
                                drama selisih kas
                            </span>
                        </h1>
                    </Reveal>

                    <Reveal delay={160}>
                        <p className="mx-auto mt-6 max-w-xl text-base text-pretty text-muted-foreground sm:text-lg lg:mx-0">
                            Amanah menggantikan hitung-total-lalu-ribut dengan
                            rekonsiliasi kas harian dan serah terima yang
                            transparan. Juragan tenang, penjaga punya bukti
                            kerja jujur.
                        </p>
                    </Reveal>

                    <Reveal delay={240}>
                        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row lg:items-start lg:justify-start">
                            {user ? (
                                <Button
                                    asChild
                                    size="lg"
                                    className="group w-full sm:w-auto"
                                >
                                    <Link href={dashboard()}>
                                        Buka Dashboard
                                        <ArrowRight className="transition-transform group-hover:translate-x-0.5" />
                                    </Link>
                                </Button>
                            ) : (
                                <>
                                    <Button
                                        asChild
                                        size="lg"
                                        className="group w-full sm:w-auto"
                                    >
                                        <Link href={register()}>
                                            Mulai Gratis
                                            <ArrowRight className="transition-transform group-hover:translate-x-0.5" />
                                        </Link>
                                    </Button>
                                    <Button
                                        asChild
                                        size="lg"
                                        variant="outline"
                                        className="w-full sm:w-auto"
                                    >
                                        <Link href={login()}>
                                            Sudah punya akun
                                        </Link>
                                    </Button>
                                </>
                            )}
                        </div>
                    </Reveal>

                    <Reveal delay={320}>
                        <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground lg:justify-start">
                            {[
                                'Masuk pakai nomor HP + OTP',
                                'Laporan otomatis ke WhatsApp',
                                'Bisa dipakai offline',
                            ].map((item) => (
                                <li
                                    key={item}
                                    className="flex items-center gap-2"
                                >
                                    <CheckCircle2 className="size-4 text-primary" />
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </Reveal>
                </div>

                {/* Floating product mockup */}
                <Reveal
                    delay={200}
                    className="relative mx-auto w-full max-w-md lg:max-w-none"
                >
                    <div className="lp-float relative">
                        <div className="rounded-2xl border border-border/70 bg-card/80 p-5 shadow-2xl shadow-primary/10 backdrop-blur">
                            <div className="flex items-center justify-between border-b border-border/60 pb-4">
                                <div className="flex items-center gap-2.5">
                                    <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                        <MessageCircle className="size-4.5" />
                                    </span>
                                    <div>
                                        <p className="text-sm font-semibold">
                                            Laporan Harian
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            Warung Barokah · Hari ini
                                        </p>
                                    </div>
                                </div>
                                <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                                    Sehat
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-3 py-4">
                                {[
                                    { label: 'Omzet', value: 'Rp 2,4 jt' },
                                    { label: 'Transaksi', value: '138' },
                                    {
                                        label: 'Kas seharusnya',
                                        value: 'Rp 2,4 jt',
                                    },
                                    { label: 'Selisih', value: '- Rp 5rb' },
                                ].map((stat) => (
                                    <div
                                        key={stat.label}
                                        className="rounded-xl border border-border/60 bg-background/60 p-3"
                                    >
                                        <p className="text-xs text-muted-foreground">
                                            {stat.label}
                                        </p>
                                        <p className="mt-1 text-lg font-semibold tracking-tight">
                                            {stat.value}
                                        </p>
                                    </div>
                                ))}
                            </div>

                            <div className="rounded-xl bg-primary/5 p-3 text-sm">
                                <p className="flex items-center gap-2 font-medium text-primary">
                                    <ShieldCheck className="size-4" />
                                    Selisih dalam toleransi
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    Auto-approve. Tidak perlu tindakan.
                                </p>
                            </div>
                        </div>

                        {/* Floating accent card */}
                        <div className="lp-float absolute -bottom-6 -left-6 hidden rounded-xl border border-border/70 bg-card/90 p-3 shadow-xl backdrop-blur [animation-delay:-3s] sm:block">
                            <p className="text-xs text-muted-foreground">
                                Serah terima
                            </p>
                            <p className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold">
                                <CheckCircle2 className="size-4 text-primary" />
                                Disetujui 2 pihak
                            </p>
                        </div>
                    </div>
                </Reveal>
            </div>
        </section>
    );
}
