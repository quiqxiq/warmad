import { LayoutDashboard, MapPinned, Mic2 } from 'lucide-react';
import { index as outletIndex } from '@/actions/App/Http/Controllers/OutletController';
import { dashboard } from '@/routes';
import { index as cashierIndex } from '@/routes/cashier';
import type { Auth, NavItem } from '@/types';

function getRoles(auth: Auth): string[] {
    const roles = [
        ...(auth.roles ?? []),
        ...(auth.user.roles ?? []),
        ...(auth.user.role ? [auth.user.role] : []),
        ...(auth.user.outlet_roles?.map((role) => role.role) ?? []),
    ];

    return [...new Set(roles.map((role) => role.toLowerCase()))];
}

export function getAppNavigation(auth: Auth): NavItem[] {
    const roles = getRoles(auth);
    const roleInformationAvailable = roles.length > 0;
    const canManageOutlets =
        !roleInformationAvailable ||
        roles.some((role) => ['owner', 'admin'].includes(role));

    return [
        {
            title: 'Dashboard',
            href: dashboard(),
            icon: LayoutDashboard,
        },
        {
            title: 'Kasir',
            href: cashierIndex(),
            icon: Mic2,
        },
        ...(canManageOutlets
            ? [
                  {
                      title: 'Outlet',
                      href: outletIndex(),
                      icon: MapPinned,
                  } satisfies NavItem,
              ]
            : []),
    ];
}
