import {
  balancePartOf,
  formatLunches,
  hasReservedBalanceWithMercadoPago,
  isPartialPayment,
  mercadoPagoPartOf,
  MP_PAYMENT_CREDITED,
  PARTIAL_RETURNED_TO_BALANCE,
} from '../../lunches';
import { formatOrderDateLabel, formatOrderPayDeadlineLabel, formatOrderTimeLabel } from '../orderDateLabels';
import { isPaidWithMercadoPago } from './comandaModel';
import type { OrderV2 } from '../../services/ordersApi';

/** Lo que muestra el encabezado cerrado de un pedido en "Mis pedidos" (F29, prototipo D7.1). */
export interface OrderAccordionHeader {
  /** "Retiro 13:00 hs". */
  time: string;
  /** "Martes 22": el día, sin mes, para las filas de "Anteriores" (bajo un día no hace falta). */
  dateLabel: string;
  /** "2 platos · 2 almuerzos". */
  summary: string;
  /** Cómo se paga (o se pagó) cuando no es lo de siempre; null = con almuerzos del saldo, sin línea. */
  payLine: string | null;
  /** Aviso corto de estado ("Ya no se puede cambiar"); null si no hay. */
  note: string | null;
}

function payLineOf(order: OrderV2, pickupLeadMinutes: number | null | undefined): string | null {
  if (order.estado === 'CANCELADO') {
    // Pago parcial (F23.1): el DTO no dice cuánto volvió, así que no se da un número.
    if (hasReservedBalanceWithMercadoPago(order)) return PARTIAL_RETURNED_TO_BALANCE;
    if (order.paidWithMercadoPago) return MP_PAYMENT_CREDITED;
    const count = order.creditTotal;
    return `${formatLunches(count)} ${count === 1 ? 'devuelto' : 'devueltos'} a tu saldo`;
  }
  if (order.estado === 'PENDIENTE_PAGO') {
    const deadline = formatOrderPayDeadlineLabel(order.pickupAt, pickupLeadMinutes);
    const base = balancePartOf(order) > 0
      ? `${balancePartOf(order)} de tu saldo · ${mercadoPagoPartOf(order)} a pagar`
      : 'A pagar con Mercado Pago';
    return deadline ? `${base}, antes de las ${deadline}` : base;
  }
  if (isPaidWithMercadoPago(order)) {
    return isPartialPayment(order)
      ? `${balancePartOf(order)} de tu saldo · ${mercadoPagoPartOf(order)} con Mercado Pago`
      : 'Pagado con Mercado Pago';
  }
  return null;
}

export function orderAccordionHeader(
  order: OrderV2,
  { now, pickupLeadMinutes }: { now: Date; pickupLeadMinutes?: number | null },
): OrderAccordionHeader {
  const upcoming = new Date(order.pickupAt).getTime() >= now.getTime();
  const dishes = order.items.length;
  let note: string | null = null;
  if (upcoming && order.estado === 'CONFIRMADO') note = 'Ya lo estamos preparando';
  else if (upcoming && order.estado === 'PENDIENTE' && !order.pickupTimeChangeable) note = 'Ya no se puede cambiar';

  return {
    time: `Retiro ${formatOrderTimeLabel(order.pickupAt)} hs`,
    dateLabel: formatOrderDateLabel(order.pickupAt).replace(/ de \S+$/, ''),
    summary: `${dishes} ${dishes === 1 ? 'plato' : 'platos'} · ${formatLunches(order.creditTotal)}`,
    payLine: payLineOf(order, pickupLeadMinutes),
    note,
  };
}
