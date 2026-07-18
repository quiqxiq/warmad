import {
    ClipboardCheck,
    HandshakeIcon,
    LineChart,
    Mic,
    NotebookPen,
    Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { Reveal } from '@/components/landing/reveal';

type Feature = {
    icon: LucideIcon;
    title: string;
    description: string;
    tag: string;
};

const FEATURES: Feature[] = [
    {
        icon: HandshakeIcon,
        title: 'Serah Terima Transparan',
        description:
            'Penjaga lama dan baru login ke sesi opname yang sama, foto per rak, dan sama-sama konfirmasi angka sebelum jadi modal awal baru.',
        tag: 'Dua pihak',
    },
    {
        icon: Wallet,
        title: 'Rekonsiliasi Kas Harian',
        description:
            'Sistem hitung kas seharusnya dari transaksi, bandingkan dengan kas fisik. Selisih terdeteksi lebih awal sebelum menumpuk.',
        tag: 'Anti sengketa',
    },
    {
        icon: Mic,
        title: 'Input Suara (Voice Queue)',
        description:
            'Rekam ucapan pembeli seperti kirim voice note. AI mem-parse jadi daftar barang di background, penjaga tinggal konfirmasi.',
        tag: 'AI parser',
    },
    {
        icon: LineChart,
        title: 'Laporan Otomatis ke WhatsApp',
        description:
            'Omzet, margin, selisih kas, dan flag anomali dikirim otomatis ke WA juragan. Tidak perlu buka aplikasi untuk tahu kondisi warung.',
        tag: 'Real-time',
    },
    {
        icon: NotebookPen,
        title: 'Utang/Piutang (Bon)',
        description:
            'Catat bon pelanggan terpisah dari selisih kas, dengan pengingat santai otomatis via WhatsApp ke yang belum lunas.',
        tag: 'Bon warung',
    },
    {
        icon: ClipboardCheck,
        title: 'Dashboard Multi-Outlet',
        description:
            'Satu akun juragan, banyak warung. Pantau semua outlet, kelola penjaga, dan atur peran akses dari satu tempat.',
        tag: 'Skala',
    },
];

export function LandingFeatures() {
    return (
        <section id="fitur" className="scroll-mt-20 py-20 sm:py-28">
            <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
                <div className="mx-auto max-w-2xl text-center">
                    <Reveal>
                        <span className="text-sm font-semibold text-primary">
                            Yang ada di dalam
                        </span>
                    </Reveal>
                    <Reveal delay={80}>
                        <h2 className="mt-3 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
                            Semua alat untuk menjaga kepercayaan
                        </h2>
                    </Reveal>
                    <Reveal delay={160}>
                        <p className="mt-4 text-pretty text-muted-foreground">
                            Bukan sekadar aplikasi kasir. Amanah fokus pada satu
                            hal yang belum dijawab kompetitor: kepercayaan saat
                            penjaga berganti.
                        </p>
                    </Reveal>
                </div>

                <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {FEATURES.map((feature, index) => (
                        <Reveal key={feature.title} delay={(index % 3) * 90}>
                            <article className="group relative h-full overflow-hidden rounded-2xl border border-border/70 bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5">
                                <div
                                    aria-hidden
                                    className="pointer-events-none absolute -top-16 -right-16 size-32 rounded-full bg-primary/10 opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100"
                                />
                                <div className="flex items-center justify-between">
                                    <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform duration-300 group-hover:scale-110">
                                        <feature.icon className="size-5.5" />
                                    </span>
                                    <span className="rounded-full border border-border/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                                        {feature.tag}
                                    </span>
                                </div>
                                <h3 className="mt-5 text-lg font-semibold tracking-tight">
                                    {feature.title}
                                </h3>
                                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                                    {feature.description}
                                </p>
                            </article>
                        </Reveal>
                    ))}
                </div>
            </div>
        </section>
    );
}
