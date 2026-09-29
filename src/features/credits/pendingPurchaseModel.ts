import { formatLunches } from '@/features/orders/lunches';
import { formatOrderShortDate, formatOrderTimeLabel, isSameRestaurantDay } from '@/features/orders/components/orderDateLabels';
import { formatPrice } from './packPricing';
import type { CreditPurchase } from './types';

/** Lo que dibuja una fila del aviso de pagos pendientes (D6), ya con el texto resuelto. */
export interface PendingItemView {
  id: string;
  /** "Paquete Semana", "3 almuerzos sueltos", "Pago del pedido #0042". */
  title: string;
  /** Nombre corto para el resumen de varios pagos ("pedido #0042"). */
  short: string;
  sub: string;
  amountLabel: string;
  badge: string;
  note: string;
  statusHref: string;
  /** Deep link a la comanda del pedido en "Mis pedidos"; `null` en paquetes o sin pedido. */
  orderHref: string | null;
  /** Pedido que se puede retomar con "Pagar ahora"; solo mientras espera el pago. */
  payNowOrderId: number | null;
  /** Nombre accesible del botón "Pagar ahora". */
  payNowLabel: string;
}

/** Mismo número que la comanda ("Comanda Nº 0042"). */
function orderNumber(orderId: number): string {
  return String(orderId).padStart(4, '0');
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** "hoy 12:05", "ayer 12:05" o "el 27/09 12:05" para cualquier otro día; hora de Buenos Aires. */
function startedLabel(createdAt: string, now: Date): string {
  const time = formatOrderTimeLabel(createdAt);
  if (isSameRestaurantDay(createdAt, now)) return `iniciado hoy ${time}`;
  if (isSameRestaurantDay(createdAt, new Date(now.getTime() - DAY_MS))) return `iniciado ayer ${time}`;
  return `iniciado el ${formatOrderShortDate(createdAt)} ${time}`;
}

/**
 * Título de un paquete: el nombre del pack; para Sueltos (el pack `DAY`, que
 * se compra con cantidad) "N almuerzos sueltos". Sin nombre, "N almuerzos".
 * El DTO no expone el código del pack, así que Sueltos se reconoce por el
 * nombre del pack `DAY` del catálogo (`looseName`).
 */
function packTitle(purchase: CreditPurchase, looseName: string | null | undefined): { title: string; isLoose: boolean } {
  const count = purchase.creditAmount;
  if (purchase.packNombre && looseName && purchase.packNombre === looseName) {
    return { title: `${count} ${count === 1 ? 'almuerzo suelto' : 'almuerzos sueltos'}`, isLoose: true };
  }
  return { title: purchase.packNombre || formatLunches(count), isLoose: false };
}

export function buildPendingItem(purchase: CreditPurchase, opts: { now: Date; looseName?: string | null }): PendingItemView {
  const count = purchase.creditAmount;
  const started = startedLabel(purchase.createdAt, opts.now);
  const common = {
    id: purchase.id,
    amountLabel: formatPrice(purchase.amountCents),
    statusHref: `/compras/${purchase.id}/procesando`,
  };

  if (purchase.type === 'PACK') {
    const { title, isLoose } = packTitle(purchase, opts.looseName);
    return {
      ...common,
      title,
      short: title,
      // Sueltos ya lleva la cantidad en el título.
      sub: isLoose ? `Mercado Pago · ${started}` : `${formatLunches(count)} · Mercado Pago · ${started}`,
      badge: `+${count} por acreditar`,
      note:
        count === 1
          ? 'El almuerzo se acredita en tu saldo apenas Mercado Pago confirme el pago.'
          : `Los ${count} almuerzos se acreditan en tu saldo apenas Mercado Pago confirme el pago.`,
      orderHref: null,
      payNowOrderId: null,
      payNowLabel: '',
    };
  }

  // DIRECT: el pago de un pedido. Sin pedido (respuesta vieja) queda solo el enlace al estado del pago.
  const orderId = purchase.orderId ?? null;
  const cancelled = purchase.orderEstado === 'CANCELADO';
  const number = orderId === null ? null : orderNumber(orderId);
  const many = count !== 1;
  const note = cancelled
    ? `Este pedido se canceló. Cuando Mercado Pago confirme el pago, ${many ? `los ${count} almuerzos se acreditan` : 'el almuerzo se acredita'} en tu saldo para que ${many ? 'los' : 'lo'} uses cuando quieras.`
    : `Apenas Mercado Pago confirme el pago, ${many ? `los ${count} almuerzos se acreditan y quedan reservados` : 'el almuerzo se acredita y queda reservado'} para este pedido.`;
  return {
    ...common,
    title: number ? `Pago del pedido #${number}` : 'Pago de tu pedido',
    short: number ? `pedido #${number}` : 'pago de tu pedido',
    sub: `${formatLunches(count)} · Mercado Pago · ${started}`,
    badge: cancelled ? `+${count} por acreditar` : `${count} para tu pedido`,
    note,
    orderHref: orderId === null ? null : `/orders/mine?pedido=${orderId}`,
    payNowOrderId: orderId !== null && purchase.orderEstado === 'PENDIENTE_PAGO' ? orderId : null,
    payNowLabel: number ? `Pagar ahora el pedido #${number} con Mercado Pago` : 'Pagar ahora con Mercado Pago',
  };
}

/** "Pago pendiente" con uno; "N pagos pendientes" con varios. */
export function pendingHeading(count: number): string {
  return count === 1 ? 'Pago pendiente' : `${count} pagos pendientes`;
}

/** "A y B" / "A, B y C": resumen de varios pagos. */
export function pendingSummary(items: Pick<PendingItemView, 'short'>[]): string {
  const names = items.map((item) => item.short);
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
}
