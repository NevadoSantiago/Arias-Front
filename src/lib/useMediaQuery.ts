import { useSyncExternalStore } from 'react';

/**
 * ¿Coincide la media query? Se lee de forma síncrona en el primer render (sin
 * parpadeo) y se actualiza al cruzar el corte. Solo para cuando el TIPO de
 * componente cambia con el ancho (hoja ↔ diálogo, barra ↔ panel); el resto se
 * resuelve con clases responsivas de Tailwind.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Mismo corte que el prefijo `lg:` de Tailwind (1024px). */
export const DESKTOP_QUERY = '(min-width: 1024px)';

export function useIsDesktop(): boolean {
  return useMediaQuery(DESKTOP_QUERY);
}
