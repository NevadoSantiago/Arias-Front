import { useEffect, useRef, useState } from 'react';

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

const easeOutCubic = (p: number) => 1 - Math.pow(1 - p, 3);

/**
 * Lleva un valor de 0 hasta `target` cada vez que el componente se monta (y
 * desde el valor actual si `target` cambia después). Con `prefers-reduced-motion`
 * el valor aparece ya en su lugar. `done` avisa que la animación terminó, para
 * encadenar cosas (p. ej. el festejo) recién después.
 */
export function useFillAnimation(target: number, durationMs = 1100): { value: number; done: boolean } {
  const [reduced] = useState(prefersReducedMotion);
  const [animated, setAnimated] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    if (reduced) return;
    const from = fromRef.current;
    if (from === target) return;
    const t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / durationMs);
      const v = p >= 1 ? target : from + (target - from) * easeOutCubic(p);
      fromRef.current = v;
      setAnimated(v);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, reduced, durationMs]);

  const value = reduced ? target : animated;
  return { value, done: value === target };
}
