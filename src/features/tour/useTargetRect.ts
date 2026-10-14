import { useEffect, useState } from 'react';
import type { Rect } from './tourGeometry';

const same = (a: Rect | null, b: Rect | null) =>
  a === b || (!!a && !!b && a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h);

/** Cada cuánto, como mucho, se vuelve a traer a la vista un elemento que quedó afuera. */
const RESCROLL_THROTTLE_MS = 300;

export function findTourTarget(target: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
}

/**
 * Rectángulo en pantalla del elemento `data-tour="<target>"`, medido en cada
 * cuadro: así sigue al elemento aunque aparezca después (hojas que se montan,
 * pantallas que cargan), se anime, se scrollee o cambie el tamaño de la
 * ventana. `null` mientras no existe o no ocupa lugar. Al aparecer lo trae a
 * la vista; después solo vuelve a traerlo si un cambio de layout (un aviso que
 * carga arriba y lo empuja) lo deja fuera de la pantalla, como mucho una vez
 * cada `RESCROLL_THROTTLE_MS` y solo si el rectángulo se movió: así no se pelea
 * con quien scrollea una hoja en un paso "probá".
 */
export function useTargetRect(target: string, scroll: ScrollLogicalPosition = 'nearest'): Rect | null {
  const [measured, setMeasured] = useState<{ target: string; rect: Rect | null }>({ target, rect: null });

  useEffect(() => {
    let frame = 0;
    let scrolled = false;
    let lastScrollAt = 0;
    let lastRect: Rect | null = null;
    // El rectángulo se movió y todavía no se corrigió: el throttle puede demorar el re-scroll unos cuadros.
    let moved = false;

    const tick = () => {
      const el = findTourTarget(target);
      let next: Rect | null = null;
      if (el) {
        const now = performance.now();
        if (!scrolled) {
          scrolled = true;
          lastScrollAt = now;
          el.scrollIntoView?.({ block: scroll, inline: 'nearest' });
        }
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) next = { x: r.left, y: r.top, w: r.width, h: r.height };
        const outOfView = r.top < 0 || r.bottom > window.innerHeight;
        if (!same(lastRect, next)) moved = true;
        if (!outOfView) {
          moved = false;
        } else if (moved && now - lastScrollAt >= RESCROLL_THROTTLE_MS) {
          moved = false;
          lastScrollAt = now;
          el.scrollIntoView?.({ block: scroll, inline: 'nearest' });
        }
      }
      lastRect = next;
      setMeasured((prev) => (prev.target === target && same(prev.rect, next) ? prev : { target, rect: next }));
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, scroll]);

  // Una medición de otro paso nunca se muestra como si fuera de este.
  return measured.target === target ? measured.rect : null;
}
