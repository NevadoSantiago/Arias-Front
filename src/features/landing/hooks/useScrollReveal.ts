import { useEffect, useRef, useState } from 'react';

/**
 * Revela un elemento cuando entra en el viewport (scroll-reveal).
 * Usa IntersectionObserver — sin librerías. Se dispara una sola vez
 * (no se vuelve a ocultar al salir) para que la lectura sea tranquila.
 *
 * Uso:
 *   const { ref, visible } = useScrollReveal();
 *   <div ref={ref} className={cn('transition-all', visible ? 'opacity-100' : 'opacity-0')} />
 */
export function useScrollReveal<T extends HTMLElement = HTMLDivElement>(
  options?: IntersectionObserverInit,
) {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Respeta a quien prefiere menos movimiento: mostramos directo.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -10% 0px', ...options },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [options]);

  return { ref, visible };
}
