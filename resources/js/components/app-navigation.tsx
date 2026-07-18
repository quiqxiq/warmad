import {
    BookOpenCheck,
    LayoutDashboard,
    MapPinned,
    Mic2,
    Users,
} from 'lucide-react';
import { index as outletIndex } from '@/actions/App/Http/Controllers/OutletController';
import { dashboard } from '@/routes';
import { index as cashierIndex } from '@/routes/cashier';
import { index as debtIndex } from '@/routes/debts';
import { index as penjagaIndex } from '@/routes/penjaga';
import type { Auth, NavItem } from '@/types';

function getRoles(auth: Auth): string[] {
    const rawRoles = [
        ...(auth.roles ?? []),
        ...(auth.user.roles ?? []),
        ...(auth.user.role ? [auth.user.role] : []),
        ...(auth.user.outlet_roles?.map((r) => r.role) ?? []),
    ];

    const stringRoles: string[] = [];
    for (const r of rawRoles) {
        if (typeof r === 'string') {
            stringRoles.push(r);
        } else if (r && typeof r === 'object') {
            const roleObj = r as Record<string, unknown>;
            if (typeof roleObj.name === 'string') {
                stringRoles.push(roleObj.name);
            } else if (typeof roleObj.role === 'string') {
                stringRoles.push(roleObj.role);
            }
        }
    }

    return [...new Set(stringRoles.map((role) => role.toLowerCase()))];
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
        {
            title: 'Bon',
            href: debtIndex(),
            icon: BookOpenCheck,
        },
        ...(canManageOutlets
            ? [
                  {
                      title: 'Outlet',
                      href: outletIndex(),
                      icon: MapPinned,
                  } satisfies NavItem,
                  {
                      title: 'Penjaga',
                      href: penjagaIndex(),
                      icon: Users,
                  } satisfies NavItem,
              ]
            : []),
    ];
}
