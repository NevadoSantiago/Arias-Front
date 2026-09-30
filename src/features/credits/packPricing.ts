import type { CreditPack } from './types';

/** Precio en pesos formateado en ARS — misma convención en todo `credits`. */
export function formatPrice(priceCents: number): string {
  return (priceCents / 100).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
}

/**
 * Elige el pack "Recomendado" entre los packs con nombre (no Sueltos): el
 * que tiene el mayor `discountPercent` — el mejor valor real para el
 * cliente, no una posición fija en la lista. Ante empate, gana el de menor
 * `ordenDisplay`. Extraído de `CreditsPacksPage` (F6) a un módulo compartido
 * para que el aviso de F18 ("Con el <pack> cada almuerzo te sale...") en el
 * flujo de pago directo lo reutilice en vez de reimplementar la regla.
 */
export function pickRecommended(packs: CreditPack[]): CreditPack | null {
  if (packs.length === 0) return null;
  return packs.reduce((best, p) => {
    if (p.discountPercent > best.discountPercent) return p;
    if (p.discountPercent === best.discountPercent && p.ordenDisplay < best.ordenDisplay) return p;
    return best;
  }, packs[0]);
}

/** Precio por almuerzo de un pack, mismo redondeo que usa `CreditsPacksPage` para mostrarlo. */
export function perLunchPriceCents(pack: Pick<CreditPack, 'priceCents' | 'creditAmount'>): number {
  return Math.round(pack.priceCents / pack.creditAmount);
}
