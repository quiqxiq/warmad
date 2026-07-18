import { useEffect, useState } from 'react';

export type NetworkStatus = {
    isOnline: boolean;
    lastChangedAt: Date | null;
};

export function useNetworkStatus(): NetworkStatus {
    const [status, setStatus] = useState<NetworkStatus>(() => ({
        isOnline: typeof navigator === 'undefined' ? true : navigator.onLine,
        lastChangedAt: null,
    }));

    useEffect(() => {
        const updateStatus = () => {
            setStatus({
                isOnline: navigator.onLine,
                lastChangedAt: new Date(),
            });
        };

        window.addEventListener('online', updateStatus);
        window.addEventListener('offline', updateStatus);

        return () => {
            window.removeEventListener('online', updateStatus);
            window.removeEventListener('offline', updateStatus);
        };
    }, []);

    return status;
}
