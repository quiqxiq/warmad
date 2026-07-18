import { useEffect, useMemo } from 'react';

export function useObjectUrl(blob: Blob): string {
    const objectUrl = useMemo(() => URL.createObjectURL(blob), [blob]);

    useEffect(() => {
        return () => URL.revokeObjectURL(objectUrl);
    }, [objectUrl]);

    return objectUrl;
}
