import { Head, usePage } from '@inertiajs/react';

import { LandingCta } from '@/components/landing/landing-cta';
import { LandingFeatures } from '@/components/landing/landing-features';
import { LandingFooter } from '@/components/landing/landing-footer';
import { LandingHero } from '@/components/landing/landing-hero';
import { LandingHowItWorks } from '@/components/landing/landing-how-it-works';
import { LandingNav } from '@/components/landing/landing-nav';
import { LandingPersonas } from '@/components/landing/landing-personas';
import { LandingPricing } from '@/components/landing/landing-pricing';

export default function Welcome() {
    const { auth } = usePage().props;
    const user = auth.user ?? null;

    return (
        <>
            <Head title="Amanah — Kelola Warung Madura Tanpa Drama Selisih Kas">
                <meta
                    name="description"
                    content="Amanah adalah platform kepercayaan untuk Warung Madura: rekonsiliasi kas harian, serah terima transparan, input suara, dan laporan otomatis ke WhatsApp."
                />
                <link rel="preconnect" href="https://fonts.bunny.net" />
                <link
                    href="https://fonts.bunny.net/css?family=instrument-sans:400,500,600,700"
                    rel="stylesheet"
                />
            </Head>

            <div className="min-h-screen scroll-smooth bg-background text-foreground antialiased">
                <LandingNav user={user} />
                <main>
                    <LandingHero user={user} />
                    <LandingFeatures />
                    <LandingHowItWorks />
                    <LandingPersonas />
                    <LandingPricing />
                    <LandingCta user={user} />
                </main>
                <LandingFooter />
            </div>
        </>
    );
}
