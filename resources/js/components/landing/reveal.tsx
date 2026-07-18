import type { ElementType, ReactNode } from 'react';

import { useRevealOnScroll } from '@/hooks/use-reveal-on-scroll';
import { cn } from '@/lib/utils';

type RevealProps = {
    children: ReactNode;
    className?: string;
    /** Stagger the reveal by a delay in milliseconds. */
    delay?: number;
    as?: ElementType;
};

/**
 * Wraps content in a scroll-triggered fade-up. Honours prefers-reduced-motion
 * via the `.lp-reveal` utility in app.css.
 */
export function Reveal({
    children,
    className,
    delay = 0,
    as: Tag = 'div',
}: RevealProps) {
    const ref = useRevealOnScroll<HTMLDivElement>();

    return (
        <Tag
            ref={ref}
            className={cn('lp-reveal', className)}
            style={delay ? { transitionDelay: `${delay}ms` } : undefined}
        >
            {children}
        </Tag>
    );
}
