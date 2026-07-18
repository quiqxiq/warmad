import { Link } from '@inertiajs/react';

import AppLogoIcon from '@/components/app-logo-icon';
import { login, register } from '@/routes';

const FOOTER_LINKS = [
    {
        heading: 'Produk',
        links: [
            { label: 'Fitur', href: '#fitur' },
            { label: 'Cara Kerja', href: '#cara-kerja' },
            { label: 'Harga', href: '#harga' },
        ],
    },
    {
        heading: 'Akun',
        links: [
            { label: 'Masuk', href: login().url },
            { label: 'Daftar', href: register().url },
        ],
    },
] as const;

export function LandingFooter() {
    const year = new Date().getFullYear();

    return (
        <footer className="border-t border-border/60 bg-card/40">
            <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
                <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
                    <div className="col-span-2">
                        <Link
                            href="/"
                            className="flex items-center gap-2.5 font-semibold tracking-tight"
                        >
                            <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                                <AppLogoIcon className="size-5 fill-current" />
                            </span>
                            <span className="text-lg">Amanah</span>
                        </Link>
                        <p className="mt-4 max-w-xs text-sm text-muted-foreground">
                            Infrastruktur kepercayaan dan operasional untuk
                            Warung Madura. Rekonsiliasi harian dan serah terima
                            yang transparan.
                        </p>
                    </div>

                    {FOOTER_LINKS.map((column) => (
                        <div key={column.heading}>
                            <h3 className="text-sm font-semibold">
                                {column.heading}
                            </h3>
                            <ul className="mt-4 space-y-2.5">
                                {column.links.map((link) => (
                                    <li key={link.label}>
                                        <a
                                            href={link.href}
                                            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                                        >
                                            {link.label}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-border/60 pt-6 sm:flex-row">
                    <p className="text-xs text-muted-foreground">
                        © {year} Amanah. Dibuat untuk warung Madura.
                    </p>
                    <p className="text-xs text-muted-foreground">
                        Masuk pakai nomor HP · Data per warung terisolasi
                    </p>
                </div>
            </div>
        </footer>
    );
}
