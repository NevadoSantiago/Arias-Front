import { formatLunches } from '../../lunches';
import type { OrderV2 } from '../../services/ordersApi';

/** Un plato de la comanda B2C — ya con los textos listos para mostrar. */
export interface ComandaItem {
  name: string;
  /** "c/ papas fritas"; null = sin acompañamiento. */
  side: string | null;
  note: string | null;
  /** "1 almuerzo" o el marcador `$ [PRECIO]` (pedido con Mercado Pago). */
  costLabel: string;
  /** Marca "Nuevo" (platos sumados a un pedido existente). */
  isNew?: boolean;
}

/** Pie de la comanda: cómo se paga (o se pagó) el pedido. */
export interface ComandaFooter {
  label: string;
  /** null = sin segunda línea (p. ej. saldo todavía desconocido). */
  value: string | null;
  icon: 'lunches' | 'card';
}

/** Marcador visible: el pedido no trae importe (no hay campo en el DTO). */
export const PRICE_PLACEHOLDER = '$ [PRECIO]';

/**
 * Pagado con Mercado Pago (B12): `paidWithMercadoPago` es verdadero con
 * CUALQUIER compra DIRECT, también una PENDING en un pedido `PENDIENTE_PAGO`,
 * así que se lee junto con `estado`.
 */
export function isPaidWithMercadoPago(order: OrderV2): boolean {
  return order.paidWithMercadoPago && order.estado !== 'PENDIENTE_PAGO';
}

/** Un pedido que se paga (o pagó) con Mercado Pago muestra el marcador de importe en vez de almuerzos. */
function isMercadoPagoOrder(order: OrderV2): boolean {
  return order.estado === 'PENDIENTE_PAGO' || isPaidWithMercadoPago(order);
}

export function comandaItems(order: OrderV2, { newItemIds }: { newItemIds?: ReadonlySet<number> } = {}): ComandaItem[] {
  const byMercadoPago = isMercadoPagoOrder(order);
  return order.items.map((item) => ({
    name: item.dishNombre,
    side: item.sideNombre ? `c/ ${item.sideNombre.toLowerCase()}` : null,
    note: item.notas,
    costLabel: byMercadoPago ? PRICE_PLACEHOLDER : formatLunches(item.creditCost),
    isNew: newItemIds?.has(item.id) ?? false,
  }));
}

/**
 * `addedLunches`: al sumar platos a un pedido existente, el pie cuenta solo
 * los almuerzos reservados de más ("Reservaste 1 almuerzo más…").
 * `justPlaced`: recién se confirmó el pedido, así que siempre es una reserva
 * (no se depende de qué tan fresco esté `now`).
 */
export function comandaFooter(
  order: OrderV2,
  {
    now,
    walletAvailable,
    addedLunches,
    justPlaced = false,
  }: { now: Date; walletAvailable: number | null; addedLunches?: number; justPlaced?: boolean },
): ComandaFooter {
  if (order.estado === 'CANCELADO') {
    if (order.paidWithMercadoPago) {
      // No se afirma nada sobre el saldo: el DTO no dice si el pago llegó a acreditarse.
      return { label: 'Pedido cancelado', value: null, icon: 'card' };
    }
    const count = order.creditTotal;
    return {
      label: 'Pedido cancelado',
      value: `${formatLunches(count)} ${count === 1 ? 'devuelto' : 'devueltos'} a tu saldo`,
      icon: 'lunches',
    };
  }
  if (order.estado === 'PENDIENTE_PAGO') {
    return { label: 'A pagar con Mercado Pago', value: PRICE_PLACEHOLDER, icon: 'card' };
  }
  if (isPaidWithMercadoPago(order)) {
    return { label: 'Pagado con Mercado Pago', value: PRICE_PLACEHOLDER, icon: 'card' };
  }
  if (justPlaced || new Date(order.pickupAt).getTime() >= now.getTime()) {
    return {
      label:
        addedLunches === undefined
          ? `Reservaste ${formatLunches(order.creditTotal)} para este pedido`
          : `Reservaste ${formatLunches(addedLunches)} más para este pedido`,
      value: walletAvailable === null ? null : `Te quedan ${formatLunches(walletAvailable)}`,
      icon: 'lunches',
    };
  }
  return { label: 'Pagado con almuerzos', value: formatLunches(order.creditTotal), icon: 'lunches' };
}
