import {
  balancePartOf,
  formatLunches,
  hasReservedBalanceWithMercadoPago,
  mercadoPagoPartOf,
  MP_PAYMENT_CREDITED,
  PARTIAL_RETURNED_TO_BALANCE,
  reservedWord,
} from '../../lunches';
import {
  formatOrderDateLabel,
  formatOrderPayDeadlineLabel,
  formatOrderTimeLabel,
  isSameRestaurantDay,
} from '../orderDateLabels';
import type { OrderV2 } from '../../services/ordersApi';

/** Un plato de la comanda B2C — ya con los textos listos para mostrar. */
export interface ComandaItem {
  /** Id del plato en el pedido (`OrderItemV2.id`): quitar un plato se pide por id, nunca por posición. */
  id: number;
  name: string;
  /** "c/ papas fritas"; null = sin acompañamiento. */
  side: string | null;
  note: string | null;
  /** "1 almuerzo" / "2 almuerzos": los platos no tienen precio, cuestan almuerzos (F28). */
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

/**
 * Pagado con Mercado Pago (B12): `paidWithMercadoPago` es verdadero con
 * CUALQUIER compra DIRECT, también una PENDING en un pedido `PENDIENTE_PAGO`,
 * así que se lee junto con `estado`.
 */
export function isPaidWithMercadoPago(order: OrderV2): boolean {
  return order.paidWithMercadoPago && order.estado !== 'PENDIENTE_PAGO';
}

export function comandaItems(order: OrderV2, { newItemIds }: { newItemIds?: ReadonlySet<number> } = {}): ComandaItem[] {
  return order.items.map((item) => ({
    id: item.id,
    name: item.dishNombre,
    side: item.sideNombre ? `c/ ${item.sideNombre.toLowerCase()}` : null,
    note: item.notas,
    costLabel: formatLunches(item.creditCost),
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
  const fromBalance = balancePartOf(order);
  if (order.estado === 'CANCELADO') {
    if (hasReservedBalanceWithMercadoPago(order)) {
      // Pago parcial (F23): el DTO no dice si el pago se aprobó antes de cancelar, así que no se da un número.
      return { label: 'Pedido cancelado', value: `${PARTIAL_RETURNED_TO_BALANCE}. ${MP_PAYMENT_CREDITED}`, icon: 'lunches' };
    }
    if (order.paidWithMercadoPago) {
      // Sin número: el DTO no dice si el pago ya se acreditó; solo que lo pagado nunca se pierde (F26).
      return { label: 'Pedido cancelado', value: MP_PAYMENT_CREDITED, icon: 'card' };
    }
    const count = order.creditTotal;
    return {
      label: 'Pedido cancelado',
      value: `${formatLunches(count)} ${count === 1 ? 'devuelto' : 'devueltos'} a tu saldo`,
      icon: 'lunches',
    };
  }
  if (order.estado === 'PENDIENTE_PAGO') {
    if (fromBalance > 0) {
      return {
        label: `${fromBalance} de tu saldo (${reservedWord(fromBalance)})`,
        value: `A pagar con Mercado Pago: ${formatLunches(mercadoPagoPartOf(order))}`,
        icon: 'card',
      };
    }
    return { label: 'A pagar con Mercado Pago', value: formatLunches(order.creditTotal), icon: 'card' };
  }
  if (isPaidWithMercadoPago(order)) {
    if (fromBalance > 0) {
      const upcoming = justPlaced || new Date(order.pickupAt).getTime() >= now.getTime();
      return {
        label: `${upcoming ? 'Reservaste' : 'Usaste'} ${formatLunches(fromBalance)} de tu saldo`,
        value: `Pagado con Mercado Pago: ${formatLunches(mercadoPagoPartOf(order))}`,
        icon: 'card',
      };
    }
    return { label: 'Pagado con Mercado Pago', value: formatLunches(order.creditTotal), icon: 'card' };
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

export function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

/**
 * "Hoy, jueves 24 de septiembre · 13:00 hs" / "Viernes 25 de septiembre · 13:00 hs".
 * Una sola forma de armarla para la comanda de "Mis pedidos" y la confirmación.
 */
export function formatComandaWhen({
  dateLabel,
  isToday,
  timeLabel,
}: {
  dateLabel: string;
  isToday: boolean;
  timeLabel: string;
}): string {
  return `${isToday ? `Hoy, ${lowerFirst(dateLabel)}` : dateLabel} · ${timeLabel} hs`;
}

export function comandaWhenLabel(order: OrderV2, now: Date): string {
  return formatComandaWhen({
    dateLabel: formatOrderDateLabel(order.pickupAt),
    isToday: isSameRestaurantDay(order.pickupAt, now),
    timeLabel: formatOrderTimeLabel(order.pickupAt),
  });
}

/**
 * Título y bajada de la comanda abierta desde "Mis pedidos" (prototipo v20).
 * Todo sale de `estado`, de los flags del backend y de `now`: el frontend no
 * recalcula ninguna ventana de corte — solo la nombra cuando la config la
 * trae (`pickupLeadMinutes`).
 */
export function comandaCopy(
  order: OrderV2,
  { now, pickupLeadMinutes }: { now: Date; pickupLeadMinutes?: number | null },
): { title: string; headline: string } {
  const time = formatOrderTimeLabel(order.pickupAt);
  const date = formatOrderDateLabel(order.pickupAt);
  const dayWhen = isSameRestaurantDay(order.pickupAt, now) ? 'hoy' : `el ${lowerFirst(date)}`;

  const fromBalance = balancePartOf(order);
  if (order.estado === 'CANCELADO') {
    // Pago parcial (F23): sin número, el DTO no dice cuánto volvió; un pago por Mercado Pago solo no toca el saldo.
    const count = order.creditTotal;
    return {
      title: 'Pedido cancelado',
      headline: hasReservedBalanceWithMercadoPago(order)
        ? `${PARTIAL_RETURNED_TO_BALANCE}. ${MP_PAYMENT_CREDITED}`
        : order.paidWithMercadoPago
          ? `Este pedido ya no se va a preparar. ${MP_PAYMENT_CREDITED}`
          : `${formatLunches(count)} ${count === 1 ? 'volvió' : 'volvieron'} a tu saldo.`,
    };
  }
  if (order.estado === 'PENDIENTE_PAGO') {
    const deadline = formatOrderPayDeadlineLabel(order.pickupAt, pickupLeadMinutes);
    const returns =
      fromBalance > 0
        ? ` y ${fromBalance === 1 ? 'tu almuerzo reservado vuelve' : 'tus almuerzos reservados vuelven'} a tu saldo`
        : '';
    return {
      title: 'Falta confirmar el pago',
      headline: `Estamos esperando la confirmación de Mercado Pago. Si no se confirma ${deadline ? `antes de las ${deadline}` : 'a tiempo'}, se cancela${returns}.`,
    };
  }
  const upcoming = new Date(order.pickupAt).getTime() >= now.getTime();
  if (upcoming && order.estado === 'PENDIENTE') {
    const editable = order.pickupTimeChangeable || order.cancellable;
    const limit = editable
      ? ` Podés cambiarlo o cancelarlo hasta ${pickupLeadMinutes != null ? `${pickupLeadMinutes} minutos antes del retiro` : 'poco antes del retiro'}.`
      : ' Ya pasó el límite para cambiarlo o cancelarlo.';
    return { title: 'Pedido programado', headline: `Te esperamos ${dayWhen} a las ${time}.${limit}` };
  }
  if (upcoming) {
    return {
      title: 'Ya lo estamos preparando',
      headline: `Te esperamos ${dayWhen} a las ${time}. Este pedido ya no se puede modificar.`,
    };
  }
  return {
    title: order.estado === 'ENTREGADO' ? 'Pedido retirado' : `Pedido del ${lowerFirst(date)}`,
    headline: `Retiro ${dayWhen} a las ${time}.`,
  };
}

/**
 * "Agregar platos" desde la comanda: la pantalla de pedido B2C abre el día
 * del pedido (`fecha`) y deja preseleccionado su horario (`hora`, ISO — el
 * mismo salto que "Sumarlo al pedido de las HH:MM"), así lo que se agregue
 * cae en este pedido.
 */
export function addPlatesPath(order: OrderV2): string {
  return `/orders/today?fecha=${order.fecha}&hora=${encodeURIComponent(order.pickupAt)}`;
}
