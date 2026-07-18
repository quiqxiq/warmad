import { Link } from '@inertiajs/react';
import { Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import AppLogoIcon from '@/components/app-logo-icon';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { dashboard, login, register } from '@/routes';
import type { User } from '@/types/auth';

const NAV_LINKS = [
    { label: 'Fitur', href: '#fitur' },
    { label: 'Cara Kerja', href: '#cara-kerja' },
    { label: 'Keunggulan', href: '#keunggulan' },
    { label: 'Harga', href: '#harga' },
] as const;

export function LandingNav({ user }: { user: User | null }) {
    const [scrolled, setScrolled] = useState(false);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 8);
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });

        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    return (
        <header
            className={cn(
                'fixed inset-x-0 top-0 z-50 transition-all duration-300',
                scrolled
                    ? 'border-b border-border/60 bg-background/80 backdrop-blur-lg'
                    : 'border-b border-transparent bg-transparent',
            )}
        >
            <nav className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
                <Link
                    href="/"
                    className="flex items-center gap-2.5 font-semibold tracking-tight"
                >
                    <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                        <AppLogoIcon className="size-5 fill-current" />
                    </span>
                    <span className="text-lg">Amanah</span>
                </Link>

                <div className="hidden items-center gap-1 md:flex">
                    {NAV_LINKS.map((link) => (
                        <a
                            key={link.href}
                            href={link.href}
                            className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                        >
                            {link.label}
                        </a>
                    ))}
                </div>

                <div className="hidden items-center gap-2 md:flex">
                    {user ? (
                        <Button asChild>
                            <Link href={dashboard()}>Buka Dashboard</Link>
                        </Button>
                    ) : (
                        <>
                            <Button asChild variant="ghost">
                                <Link href={login()}>Masuk</Link>
                            </Button>
                            <Button asChild>
                                <Link href={register()}>Daftar Gratis</Link>
                            </Button>
                        </>
                    )}
                </div>

                <button
                    type="button"
                    onClick={() => setOpen((v) => !v)}
                    className="inline-flex size-9 items-center justify-center rounded-md text-foreground md:hidden"
                    aria-label={open ? 'Tutup menu' : 'Buka menu'}
                    aria-expanded={open}
                >
                    {open ? (
                        <X className="size-5" />
                    ) : (
                        <Menu className="size-5" />
                    )}
                </button>
            </nav>

            {open ? (
                <div className="border-t border-border/60 bg-background/95 backdrop-blur-lg md:hidden">
                    <div className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-4 py-4 sm:px-6">
                        {NAV_LINKS.map((link) => (
                            <a
                                key={link.href}
                                href={link.href}
                                onClick={() => setOpen(false)}
                                className="rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                            >
                                {link.label}
                            </a>
                        ))}
                        <div className="mt-2 flex flex-col gap-2">
                            {user ? (
                                <Button asChild>
                                    <Link href={dashboard()}>
                                        Buka Dashboard
                                    </Link>
                                </Button>
                            ) : (
                                <>
                                    <Button asChild variant="outline">
                                        <Link href={login()}>Masuk</Link>
                                    </Button>
                                    <Button asChild>
                                        <Link href={register()}>
                                            Daftar Gratis
                                        </Link>
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            ) : null}
        </header>
    );
}
