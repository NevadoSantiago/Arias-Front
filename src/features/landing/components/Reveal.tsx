import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { useScrollReveal } from '../hooks/useScrollReveal';

/**
 * Envuelve contenido para que aparezca con un fade + slide-up al entrar
 * en viewport. `delay` (ms) permite escalonar elementos de una misma fila.
 */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const { ref, visible } = useScrollReveal();

  return (
    <div
      ref={ref}
      style={{ transitionDelay: visible ? `${delay}ms` : '0ms' }}
      className={cn(
        'transition-all duration-700 ease-out motion-reduce:transition-none',
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8',
        className,
      )}
    >
      {children}
    </div>
  );
}
