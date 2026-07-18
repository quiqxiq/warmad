import type { Auth, OfflineOwner } from '@/types';

export function getOfflineOwner(auth: Auth): OfflineOwner {
    const tenantId = auth.user.tenant_id;

    if (tenantId === null) {
        throw new Error('Akun ini belum terhubung ke tenant Amanah.');
    }

    return {
        tenantId,
        userId: auth.user.id,
    };
}

export function offlineOwnerKey(owner: OfflineOwner): string {
    return `${owner.tenantId}:${owner.userId}`;
}

export function isSameOfflineOwner(
    left: OfflineOwner,
    right: OfflineOwner,
): boolean {
    return left.tenantId === right.tenantId && left.userId === right.userId;
}
