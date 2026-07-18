import { Check, Store, UserRound } from 'lucide-react';

import { Reveal } from '@/components/landing/reveal';

const JURAGAN_POINTS = [
    'Tahu kondisi warung tanpa datang atau telepon',
    'Laporan otomatis tiap hari langsung ke WhatsApp',
    'Sengketa serah terima jadi berbasis data, bukan debat',
    'Pantau banyak outlet dari satu dashboard',
];

const PENJAGA_POINTS = [
    'Proses serah terima tidak lagi menegangkan',
    'Punya bukti objektif kalau bekerja jujur',
    'Alat kerja cepat, bisa input pakai suara',
    'Tetap jalan walau sinyal warung timbul-tenggelam',
];

export function LandingPersonas() {
    return (
        <section id="keunggulan" className="scroll-mt-20 py-20 sm:py-28">
            <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
                <div className="mx-auto max-w-2xl text-center">
                    <Reveal>
                        <span className="text-sm font-semibold text-primary">
                            Dua sisi, satu kepercayaan
                        </span>
                    </Reveal>
                    <Reveal delay={80}>
                        <h2 className="mt-3 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
                            Dirancang untuk juragan dan penjaga sekaligus
                        </h2>
                    </Reveal>
                </div>

                <div className="mt-14 grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <Reveal>
                        <PersonaCard
                            icon={<Store className="size-5" />}
                            role="Juragan"
                            headline="Visibilitas tanpa harus mengawasi"
                            points={JURAGAN_POINTS}
                        />
                    </Reveal>
                    <Reveal delay={120}>
                        <PersonaCard
                            icon={<UserRound className="size-5" />}
                            role="Penjaga"
                            headline="Bukti kerja jujur yang selalu tercatat"
                            points={PENJAGA_POINTS}
                            accent
                        />
                    </Reveal>
                </div>
            </div>
        </section>
    );
}

function PersonaCard({
    icon,
    role,
    headline,
    points,
    accent = false,
}: {
    icon: React.ReactNode;
    role: string;
    headline: string;
    points: string[];
    accent?: boolean;
}) {
    return (
        <div
            className={
                accent
                    ? 'relative h-full overflow-hidden rounded-3xl border border-primary/30 bg-primary/[0.06] p-8'
                    : 'relative h-full overflow-hidden rounded-3xl border border-border/70 bg-card p-8'
            }
        >
            <div className="flex items-center gap-3">
                <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    {icon}
                </span>
                <span className="text-sm font-semibold text-muted-foreground">
                    Untuk {role}
                </span>
            </div>
            <h3 className="mt-5 text-2xl font-semibold tracking-tight text-balance">
                {headline}
            </h3>
            <ul className="mt-6 space-y-3">
                {points.map((point) => (
                    <li key={point} className="flex items-start gap-3 text-sm">
                        <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                            <Check className="size-3.5" />
                        </span>
                        <span className="text-foreground/90">{point}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}
