import { formatLunches } from './lunches';
import { formatOrderTimeLabel } from './components/orderDateLabels';
import type { OrderV2 } from './services/ordersApi';

/**
 * Ventana de devolución de un pedido. `cancellable` (backend) dice si todavía se
 * puede cancelar; si el almuerzo vuelve al saldo lo dice el reloj contra
 * `refundableUntil`. Un pedido esperando el pago no consumió almuerzos, así que
 * nunca cuenta como tardío.
 */
export function isRefundable(order: Pick<OrderV2, 'refundableUntil' | 'estado'>, now: Date): boolean {
  if (order.estado === 'PENDIENTE_PAGO' || !order.refundableUntil) return true;
  return now.getTime() < new Date(order.refundableUntil).getTime();
}

/** "12:40": el límite de devolución en la hora del restaurante; null si el pedido no lo trae. */
export function refundDeadlineLabel(order: Pick<OrderV2, 'refundableUntil'>): string | null {
  return order.refundableUntil ? formatOrderTimeLabel(order.refundableUntil) : null;
}

/** "Con devolución hasta las 12:40" / "Sin devolución desde las 12:40" para un pedido activo; null si no corresponde. */
export function refundWindowLine(order: OrderV2, now: Date): string | null {
  if (!order.cancellable || order.estado === 'PENDIENTE_PAGO' || order.estado === 'CANCELADO') return null;
  const deadline = refundDeadlineLabel(order);
  if (!deadline) return null;
  return isRefundable(order, now) ? `Con devolución hasta las ${deadline}` : `Sin devolución desde las ${deadline}`;
}

/** Resultado de una cancelación: "Almuerzo devuelto" / "2 almuerzos consumidos"; null si el backend no lo informa. */
export function cancelOutcomeLabel(order: Pick<OrderV2, 'cancelRefunded' | 'creditTotal'>): string | null {
  const count = order.creditTotal;
  if (order.cancelRefunded === true) return count === 1 ? 'Almuerzo devuelto' : `${count} almuerzos devueltos`;
  if (order.cancelRefunded === false) return `${formatLunches(count)} ${count === 1 ? 'consumido' : 'consumidos'}`;
  return null;
}

/** Textos de la cancelación tardía según la cantidad de almuerzos del pedido. */
export function lateCancelCopy(count: number): { notRefunded: string; charged: string } {
  return count === 1
    ? { notRefunded: 'Este almuerzo no se devuelve', charged: 'se cobra' }
    : { notRefunded: `Tus ${count} almuerzos no se devuelven`, charged: 'se cobran' };
}
