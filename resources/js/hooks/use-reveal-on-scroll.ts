import { useEffect, useRef } from 'react';

/**
 * Adds the `is-visible` class to an element the first time it scrolls into
 * view, driving the `.lp-reveal` transition. Falls back to immediately visible
 * when IntersectionObserver is unavailable (SSR / old browsers).
 */
export function useRevealOnScroll<T extends HTMLElement = HTMLElement>() {
    const ref = useRef<T | null>(null);

    useEffect(() => {
        const node = ref.current;

        if (node === null) {
            return;
        }

        if (typeof IntersectionObserver === 'undefined') {
            node.classList.add('is-visible');

            return;
        }

        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('is-visible');
                        observer.unobserve(entry.target);
                    }
                }
            },
            { threshold: 0.15, rootMargin: '0px 0px -10% 0px' },
        );

        observer.observe(node);

        return () => observer.disconnect();
    }, []);

    return ref;
}
