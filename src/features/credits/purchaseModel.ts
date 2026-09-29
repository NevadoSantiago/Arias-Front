import { formatLunches } from '@/features/orders/lunches';
import { formatPrice, perLunchPriceCents, pickRecommended } from './packPricing';
import type { PackCheckoutSelection } from './components/PackCheckoutSheet';
import type { CreditPack } from './types';

/** Código del pack "Sueltos": se compra `quantity` veces (1..10). */
export const DAY_CODE = 'DAY';
/** Código del pack "Paquete Semana" (el que empuja el aviso de Sueltos). */
export const WEEK_CODE = 'WEEK';
/** Los almuerzos vencen a los 90 días de la última compra (mismo texto que en la pantalla). */
export const EXPIRY_DAYS = 90;

export interface PackCatalog {
  /** Pack "Sueltos" habilitado, si lo hay. */
  dayPack: CreditPack | null;
  /** Packs con nombre habilitados, por `ordenDisplay`. */
  namedPacks: CreditPack[];
  /** El de mayor descuento (ver `pickRecommended`). */
  recommended: CreditPack | null;
  /** "Paquete Semana": por código, o el primero con nombre. */
  weekPack: CreditPack | null;
}

export type PurchaseSelection = { kind: 'loose' } | { kind: 'pack'; packId: number };

/** Parte el catálogo de `/packs` en Sueltos + packs con nombre. Sin lógica de precios: eso viene del servidor. */
export function buildCatalog(allPacks: CreditPack[] | undefined): PackCatalog {
  const all = allPacks ?? [];
  const dayPack = all.find((p) => p.code === DAY_CODE && p.enabled) ?? null;
  const namedPacks = all
    .filter((p) => p.code !== DAY_CODE && p.enabled)
    .sort((a, b) => a.ordenDisplay - b.ordenDisplay);
  return {
    dayPack,
    namedPacks,
    recommended: pickRecommended(namedPacks),
    weekPack: namedPacks.find((p) => p.code === WEEK_CODE) ?? namedPacks[0] ?? null,
  };
}

/**
 * Selección efectiva: la elegida o, si todavía no se eligió nada, la inicial
 * (`loose` en móvil, `week` en escritorio). Si Sueltos no está a la venta se usa
 * el pack recomendado. Derivada en vez de un efecto que dispare otro render.
 */
export function resolveSelection(
  selection: PurchaseSelection | null,
  catalog: PackCatalog,
  initial: 'loose' | 'week',
): PurchaseSelection | null {
  const chosen: PurchaseSelection | null =
    selection ??
    (initial === 'week' && catalog.weekPack
      ? { kind: 'pack', packId: catalog.weekPack.id }
      : { kind: 'loose' });
  if (chosen.kind === 'loose' && !catalog.dayPack) {
    return catalog.recommended ? { kind: 'pack', packId: catalog.recommended.id } : null;
  }
  return chosen;
}

export interface PurchasePlan {
  /** Cuerpo de `createPurchase` (`type: 'PACK'`); `quantity` solo para Sueltos. */
  payload: { packId: number; quantity?: number };
  summary: { label: string; totalLabel: string };
  checkout: PackCheckoutSelection;
}

/** Qué se compra con esta selección: pago, resumen y datos de "Revisá tu compra". `null` si no hay nada válido. */
export function planPurchase(
  selection: PurchaseSelection | null,
  qty: number,
  catalog: PackCatalog,
  available: number | null,
): PurchasePlan | null {
  if (!selection) return null;

  if (selection.kind === 'loose') {
    const { dayPack } = catalog;
    if (!dayPack) return null;
    const totalLabel = formatPrice(dayPack.priceCents * qty);
    return {
      payload: { packId: dayPack.id, quantity: qty },
      summary: { label: `Sueltos · ${formatLunches(qty)}`, totalLabel },
      checkout: {
        isLoose: true,
        icon: 'plate',
        productName: 'Almuerzos sueltos',
        amountLabel: formatLunches(qty),
        perLunchLabel: formatPrice(dayPack.priceCents),
        hasDiscount: false,
        discountLabel: '',
        totalLabel,
        fromAvailable: available,
        toAvailable: available === null ? null : available + qty,
      },
    };
  }

  const pack = catalog.namedPacks.find((p) => p.id === selection.packId);
  if (!pack) return null;
  const totalLabel = formatPrice(pack.priceCents);
  return {
    payload: { packId: pack.id },
    summary: { label: `${pack.nombre} · ${formatLunches(pack.creditAmount)}`, totalLabel },
    checkout: {
      isLoose: false,
      icon: catalog.namedPacks[0]?.id === pack.id ? 'stack2' : 'stack5',
      productName: pack.nombre,
      amountLabel: formatLunches(pack.creditAmount),
      perLunchLabel: formatPrice(perLunchPriceCents(pack)),
      hasDiscount: pack.discountPercent > 0,
      discountLabel: `−${pack.discountPercent}%`,
      totalLabel,
      fromAvailable: available,
      toAvailable: available === null ? null : available + pack.creditAmount,
    },
  };
}

/** Fecha en que vencerían los almuerzos si se comprara hoy (cada compra renueva el plazo). */
export function expiryAfterPurchase(now: Date = new Date()): Date {
  const d = new Date(now);
  d.setDate(d.getDate() + EXPIRY_DAYS);
  return d;
}
