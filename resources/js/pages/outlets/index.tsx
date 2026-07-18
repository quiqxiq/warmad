import { Head } from '@inertiajs/react';
import { index as outletIndex } from '@/actions/App/Http/Controllers/OutletController';
import type { Outlet } from '@/types';

type OutletWithShiftCount = Outlet & {
    shifts_count: number;
};

interface OutletsIndexProps {
    outlets: OutletWithShiftCount[];
}

export default function OutletsIndex({ outlets }: OutletsIndexProps) {
    return (
        <>
            <Head title="Outlet" />
            <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
                <h1 className="text-xl font-semibold">Outlet</h1>
                {outlets.length === 0 ? (
                    <p className="text-muted-foreground">
                        Belum ada outlet. Buat outlet pertama untuk memulai.
                    </p>
                ) : (
                    <ul className="grid auto-rows-min gap-4 md:grid-cols-3">
                        {outlets.map((outlet) => (
                            <li
                                key={outlet.id}
                                className="rounded-xl border border-sidebar-border/70 p-4 dark:border-sidebar-border"
                            >
                                <p className="font-medium">{outlet.name}</p>
                                {outlet.address && (
                                    <p className="text-sm text-muted-foreground">
                                        {outlet.address}
                                    </p>
                                )}
                                <p className="mt-2 text-sm text-muted-foreground">
                                    {outlet.shifts_count} shift tercatat
                                </p>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </>
    );
}

OutletsIndex.layout = {
    breadcrumbs: [
        {
            title: 'Outlet',
            href: outletIndex(),
        },
    ],
};
