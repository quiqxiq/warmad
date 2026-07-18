import { Link, usePage } from '@inertiajs/react';
import { MapPin, ShieldCheck, Wifi, WifiOff } from 'lucide-react';
import { getAppNavigation } from '@/components/app-navigation';
import { SyncStatus } from '@/components/cashier/sync-status';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { useOfflineSales } from '@/hooks/use-offline-sales';
import { index as cashierIndex } from '@/routes/cashier';
import type { Outlet } from '@/types';

export default function CashierLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { props } = usePage();
    const selectedOutlet =
        (props.selectedOutlet as Outlet | null | undefined) ?? null;
    const navigationItems = getAppNavigation(props.auth);
    const { isCurrentOrParentUrl } = useCurrentUrl();
    const offlineSales = useOfflineSales(selectedOutlet?.id);
    const { isOnline } = offlineSales;

    return (
        <div className="cashier-shell min-h-dvh overflow-x-hidden bg-background pb-24">
            <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur-xl">
                <div className="mx-auto flex min-h-16 w-full max-w-7xl items-center gap-2 px-3 sm:px-6">
                    <Link
                        href={cashierIndex()}
                        className="inline-flex min-h-12 shrink-0 items-center gap-2 font-bold"
                    >
                        <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                            <ShieldCheck className="size-5" />
                        </span>
                        <span className="hidden sm:inline">Amanah</span>
                    </Link>

                    <div className="min-w-0 flex-1 border-l pl-3">
                        <p className="truncate text-sm font-bold">
                            {selectedOutlet?.name ?? 'Kasir Amanah'}
                        </p>
                        <p className="flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                            {selectedOutlet ? (
                                <MapPin className="size-3 shrink-0" />
                            ) : isOnline ? (
                                <Wifi className="size-3 shrink-0" />
                            ) : (
                                <WifiOff className="size-3 shrink-0" />
                            )}
                            {selectedOutlet?.address ||
                                (isOnline ? 'Online' : 'Offline')}
                        </p>
                    </div>

                    <span
                        className={`hidden min-h-8 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold sm:inline-flex ${
                            isOnline
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                                : 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200'
                        }`}
                    >
                        {isOnline ? (
                            <Wifi className="size-3.5" />
                        ) : (
                            <WifiOff className="size-3.5" />
                        )}
                        {isOnline ? 'Online' : 'Offline'}
                    </span>

                    <SyncStatus
                        compact
                        isOnline={isOnline}
                        pendingCount={offlineSales.pendingCount}
                        status={offlineSales.status}
                        onSync={() => void offlineSales.syncNow()}
                    />
                </div>
            </header>

            <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-7xl flex-col">
                {children}
            </div>

            <nav
                aria-label="Navigasi kasir"
                className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-xl"
            >
                <div
                    className="mx-auto grid max-w-lg gap-1 pt-2"
                    style={{
                        gridTemplateColumns: `repeat(${navigationItems.length}, minmax(0, 1fr))`,
                    }}
                >
                    {navigationItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = isCurrentOrParentUrl(item.href);

                        return (
                            <Link
                                key={item.title}
                                href={item.href}
                                prefetch
                                className={`flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-semibold transition active:scale-[0.98] ${
                                    isActive
                                        ? 'bg-primary/10 text-primary'
                                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                }`}
                            >
                                {Icon && <Icon className="size-5" />}
                                <span className="truncate">{item.title}</span>
                            </Link>
                        );
                    })}
                </div>
            </nav>
        </div>
    );
}
