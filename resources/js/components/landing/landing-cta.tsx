import { Link } from '@inertiajs/react';
import { ArrowRight } from 'lucide-react';

import { Reveal } from '@/components/landing/reveal';
import { Button } from '@/components/ui/button';
import { dashboard, login, register } from '@/routes';
import type { User } from '@/types/auth';

export function LandingCta({ user }: { user: User | null }) {
    return (
        <section className="py-20 sm:py-28">
            <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
                <Reveal>
                    <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-primary px-6 py-14 text-center text-primary-foreground sm:px-12 sm:py-20">
                        <div
                            aria-hidden
                            className="pointer-events-none absolute inset-0 -z-10"
                        >
                            <div className="lp-aurora absolute -top-24 left-1/4 size-72 rounded-full bg-white/20 blur-3xl" />
                            <div className="lp-aurora absolute -right-16 -bottom-24 size-80 rounded-full bg-chart-2/30 blur-3xl [animation-delay:-5s]" />
                        </div>
                        <h2 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight text-balance sm:text-4xl">
                            Siap menjaga warung dengan lebih tenang?
                        </h2>
                        <p className="mx-auto mt-4 max-w-xl text-pretty text-primary-foreground/85">
                            Daftar dalam hitungan menit pakai nomor HP. Gratis
                            untuk warung pertama, tanpa kartu kredit.
                        </p>
                        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                            {user ? (
                                <Button
                                    asChild
                                    size="lg"
                                    variant="secondary"
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
                                        variant="secondary"
                                        className="group w-full sm:w-auto"
                                    >
                                        <Link href={register()}>
                                            Daftar Sekarang
                                            <ArrowRight className="transition-transform group-hover:translate-x-0.5" />
                                        </Link>
                                    </Button>
                                    <Button
                                        asChild
                                        size="lg"
                                        variant="ghost"
                                        className="w-full text-primary-foreground hover:bg-white/15 hover:text-primary-foreground sm:w-auto"
                                    >
                                        <Link href={login()}>Masuk</Link>
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>
                </Reveal>
            </div>
        </section>
    );
}
