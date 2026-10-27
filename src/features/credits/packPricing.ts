import type { AccountDiscount, CreditPack } from './types';

/**
 * Precio para pantallas del cliente: pesos enteros, sin centavos (redondeo al
 * peso mas cercano). Las pantallas de admin usan `formatPriceExact`.
 */
export function formatPrice(priceCents: number, currency = 'ARS'): string {
  return (priceCents / 100).toLocaleString('es-AR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
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

/**
 * Total con el descuento de la cuenta: misma fórmula que el servidor
 * (`floor(lista * (100 - %) / 100 / 100) * 100`, es decir hacia abajo al peso
 * entero) con aritmética entera. Si el resultado fuera 0 no hay descuento.
 * Solo informativo: el cobro real lo decide siempre el servidor.
 */
export function applyAccountDiscount(
  listCents: number,
  discount: Pick<AccountDiscount, 'percent'> | null | undefined,
): number {
  if (!discount || discount.percent <= 0) return listCents;
  const discounted = Math.floor((listCents * (100 - discount.percent)) / 10_000) * 100;
  return discounted > 0 ? discounted : listCents;
}

/** El descuento solo si todavía no venció según el reloj local (el servidor sigue siendo la autoridad al cobrar). */
export function activeAccountDiscount(
  discount: AccountDiscount | null | undefined,
  now: Date = new Date(),
): AccountDiscount | null {
  if (!discount) return null;
  return new Date(discount.expiresAt).getTime() > now.getTime() ? discount : null;
}

const HOUR_MS = 3_600_000;

/** "Vence en 6 d 20 h" / "Vence en 5 h" (urgente en el último día); `null` si ya venció. */
export function formatDiscountCountdown(
  expiresAt: string,
  now: Date = new Date(),
): { label: string; urgent: boolean } | null {
  const msLeft = new Date(expiresAt).getTime() - now.getTime();
  if (!(msLeft > 0)) return null;
  const hours = Math.max(1, Math.floor(msLeft / HOUR_MS));
  if (hours < 24) return { label: `Vence en ${hours} h`, urgent: true };
  return { label: `Vence en ${Math.floor(hours / 24)} d ${hours % 24} h`, urgent: false };
}

/** "lun 2/11 13:42" — vencimiento corto para las notas del descuento. */
export function formatDiscountExpiry(expiresAt: string): string {
  const d = new Date(expiresAt);
  const weekday = d.toLocaleDateString('es-AR', { weekday: 'short' }).replace('.', '');
  const time = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${weekday} ${d.getDate()}/${d.getMonth() + 1} ${time}`;
}
