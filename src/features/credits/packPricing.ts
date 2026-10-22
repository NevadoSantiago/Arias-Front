import type { CreditPack } from './types';

/**
 * Precio para pantallas del cliente: pesos enteros, sin centavos (redondeo al
 * peso mas cercano). Las pantallas de admin usan `formatPriceExact`.
 */
export function formatPrice(priceCents: number, currency = 'ARS'): string {
  return (priceCents / 100).toLocaleString('es-AR', { style: 'currency', currency, maximumFractionDigits: 0 });
}

/** Precio con centavos, para admin (p. ej. la vista de pagos necesita $849,60). */
export function formatPriceExact(priceCents: number): string {
  return (priceCents / 100).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
}

/**
 * Elige el pack "Recomendado" entre los packs con nombre (no Sueltos): el
 * que tiene el mayor `discountPercent` — el mejor valor real para el
 * cliente, no una posición fija en la lista. Ante empate, gana el de menor
 * `ordenDisplay`. Extraído de `BuyLunchesSheet` (F6) a un módulo compartido
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

/** Precio por almuerzo de un pack, mismo redondeo que usa `BuyLunchesSheet` para mostrarlo. */
export function perLunchPriceCents(pack: Pick<CreditPack, 'priceCents' | 'creditAmount'>): number {
  return Math.round(pack.priceCents / pack.creditAmount);
}

/**
 * Lema de la tarjeta de un pack. El backend no lo manda: se deduce de la
 * cantidad de almuerzos (1 hoy, hasta 9 la semana, 10 o mas el mes).
 */
export function packTagline(creditAmount: number): string {
  if (creditAmount <= 1) return 'Resolvé hoy';
  if (creditAmount < 10) return 'Resolvé tu semana';
  return '¡Resolvé todo el mes!';
}
