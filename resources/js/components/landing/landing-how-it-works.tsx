import { Reveal } from '@/components/landing/reveal';

const STEPS = [
    {
        step: '01',
        title: 'Daftar & buat warung',
        description:
            'Juragan daftar pakai nomor HP, verifikasi lewat OTP WhatsApp, lalu buat outlet pertama. Tanpa email, tanpa password ribet.',
    },
    {
        step: '02',
        title: 'Opname awal jadi modal',
        description:
            'Hitung stok awal per rak dengan scan, suara, atau ketik. Angka ini terkunci sebagai baseline modal yang jadi acuan semua rekonsiliasi.',
    },
    {
        step: '03',
        title: 'Penjaga catat transaksi',
        description:
            'Selama shift, penjaga catat penjualan lewat tombol kategori atau rekam suara. Semua tersimpan lokal dulu, sync saat ada koneksi.',
    },
    {
        step: '04',
        title: 'Tutup shift & laporan otomatis',
        description:
            'Di akhir shift, kas dicocokkan otomatis. Ringkasan harian langsung terkirim ke WhatsApp juragan dengan flag kalau ada anomali.',
    },
];

export function LandingHowItWorks() {
    return (
        <section
            id="cara-kerja"
            className="relative scroll-mt-20 overflow-hidden py-20 sm:py-28"
        >
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,var(--color-accent)_0%,transparent_45%)] opacity-40"
            />
            <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
                <div className="mx-auto max-w-2xl text-center">
                    <Reveal>
                        <span className="text-sm font-semibold text-primary">
                            Cara kerja
                        </span>
                    </Reveal>
                    <Reveal delay={80}>
                        <h2 className="mt-3 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
                            Dari daftar sampai laporan, dalam empat langkah
                        </h2>
                    </Reveal>
                </div>

                <div className="relative mt-16">
                    {/* Connecting line on desktop */}
                    <div
                        aria-hidden
                        className="absolute top-0 left-[27px] hidden h-full w-px bg-gradient-to-b from-primary/50 via-border to-transparent lg:block"
                    />
                    <ol className="flex flex-col gap-8 lg:gap-10">
                        {STEPS.map((item, index) => (
                            <Reveal key={item.step} delay={index * 80} as="li">
                                <div className="flex gap-5 lg:gap-8">
                                    <div className="relative z-10 flex size-14 shrink-0 items-center justify-center rounded-2xl border border-border/70 bg-card font-mono text-sm font-semibold text-primary shadow-sm">
                                        {item.step}
                                    </div>
                                    <div className="pt-1.5">
                                        <h3 className="text-xl font-semibold tracking-tight">
                                            {item.title}
                                        </h3>
                                        <p className="mt-2 max-w-xl text-pretty text-muted-foreground">
                                            {item.description}
                                        </p>
                                    </div>
                                </div>
                            </Reveal>
                        ))}
                    </ol>
                </div>
            </div>
        </section>
    );
}
