import { Clock3, CreditCard, Pencil, UtensilsCrossed, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { balancePartOf, formatLunches, isPartialPayment, mercadoPagoPartOf, MP_PAYMENT_CREDITED } from '../lunches';
import { formatOrderDayLabel, formatOrderPayDeadlineLabel, formatOrderTimeLabel } from './orderDateLabels';
import { OrderStatusBadge } from './OrderStatusBadge';
import { orderStatusLabel } from './orderStatus';
import type { OrderItemV2, OrderV2 } from '../services/ordersApi';

interface Props {
  order: OrderV2;
  /** Instante de referencia para el prefijo "Hoy, " — se calcula una vez por carga de datos en la página. */
  now: Date;
  onRequestCancel: () => void;
  /**
   * Optativo (F16) — cuando se pasa, cada plato de un pedido modificable
   * (`order.cancellable`) muestra una "×" para quitarlo, que abre un modal
   * de confirmación en la página (no acá: este componente sigue siendo
   * presentacional puro). Prop aditiva con default `undefined`: sin ella no
   * aparece ninguna "×", así que `MyOrdersPage` queda sin cambios. NUNCA se
   * ofrece para un pedido `PENDIENTE_PAGO` — no es modificable aunque
   * `cancellable` sea `true` (ver `assertModifiable` en el backend).
   */
  onRequestRemoveItem?: (item: OrderItemV2) => void;
  /**
   * `getRestaurantConfig().pickupLeadMinutes` (F18) — antelación de corte
   * para el aviso de "Pago pendiente". `undefined`/`null` cuando no se
   * conoce (backend viejo, config sin cargar): el aviso omite el horario.
   */
  pickupLeadMinutes?: number | null;
  /** Optativo (F18) — cuando se pasa, un pedido `PENDIENTE_PAGO` cancelable ofrece "Pagar ahora". */
  onRequestPayNow?: (order: OrderV2) => void;
  /** true mientras `onRequestPayNow` está en curso PARA ESTE pedido — deshabilita el botón. */
  payingNow?: boolean;
  /**
   * Optativo (F19) — cuando se pasa, un pedido con `pickupTimeChangeable`
   * (lo decide el backend: programado y antes del corte) ofrece "Cambiar
   * horario" junto al horario de retiro. Prop aditiva con default
   * `undefined`: sin ella no aparece la acción y la tarjeta queda igual.
   */
  onRequestChangePickupTime?: (order: OrderV2) => void;
  /**
   * Optativo (F20) — cuando se pasa, tocar la tarjeta abre la comanda del
   * pedido (`MyOrdersPage`). El área táctil es un botón con el día del
   * pedido cuyo pseudo-elemento cubre la tarjeta entera; las acciones de la
   * tarjeta quedan por encima, en áreas propias (no abren la comanda). Prop
   * aditiva con default `undefined`: sin ella la tarjeta queda igual.
   */
  onOpen?: (order: OrderV2) => void;
}

/**
 * Presentacional puro: una tarjeta tipo ticket de "Mis pedidos" (F10,
 * prototipo `MyOrders.dc.html`). La acción de cancelar se ofrece
 * ÚNICAMENTE cuando `order.cancellable` es `true` — ese valor viene siempre
 * del backend (`OrderPlacementService.isCancellable`, misma regla que
 * `cancel()`), el frontend nunca recalcula la ventana de cancelación. El
 * botón abre la hoja de confirmación (`CancelOrderSheet`) en la página, no
 * cancela directamente.
 */
export function OrderCard({
  order,
  now,
  onRequestCancel,
  onRequestRemoveItem,
  pickupLeadMinutes,
  onRequestPayNow,
  payingNow,
  onRequestChangePickupTime,
  onOpen,
}: Props) {
  const dayLabel = formatOrderDayLabel(order.pickupAt, now);
  const timeLabel = formatOrderTimeLabel(order.pickupAt);
  const isCancelled = order.estado === 'CANCELADO';
  const isAwaitingPayment = order.estado === 'PENDIENTE_PAGO';
  // F18: mismo par (isCancellable) que decide "Cancelar pedido" — el
  // backend nunca la deja modificable aunque cancellable sea true.
  const canRemoveItems = !!onRequestRemoveItem && order.cancellable && !isAwaitingPayment;
  const canChangePickupTime = !!onRequestChangePickupTime && order.pickupTimeChangeable;
  // Pago parcial (F23): los almuerzos del saldo y los que cobra Mercado Pago, por separado.
  const fromBalance = balancePartOf(order);
  const lunchesLabel = !isPartialPayment(order)
    ? formatLunches(order.creditTotal)
    : isCancelled
      ? 'Almuerzos reservados devueltos'
      : `${fromBalance} de tu saldo · ${mercadoPagoPartOf(order)} ${isAwaitingPayment ? 'a pagar' : 'con Mercado Pago'}`;
  const deadlineLabel = formatOrderPayDeadlineLabel(order.pickupAt, pickupLeadMinutes);
  const payDeadlineText = deadlineLabel
    ? `Estamos esperando la confirmación de Mercado Pago. Si no se confirma antes de las ${deadlineLabel}, se cancela.`
    : 'Estamos esperando la confirmación de Mercado Pago. Si no se confirma a tiempo, se cancela.';

  return (
    // data-testid: la tarjeta y sus ítems son ambos <li>, así que el rol
    // "listitem" no alcanza para distinguir un pedido de sus platos.
    <li data-testid="order-card">
      <div
        className={cn(
          'overflow-hidden rounded-lg border border-border bg-card',
          onOpen && 'relative',
          isCancelled && 'opacity-80',
        )}
      >
        <div className="flex items-start justify-between gap-3 p-4 pb-3">
          <div className="flex flex-col gap-1">
            {onOpen ? (
              <button
                type="button"
                onClick={() => onOpen(order)}
                aria-label={`Ver la comanda del pedido del ${dayLabel.toLowerCase()}, retiro ${timeLabel}, ${orderStatusLabel(order.estado).toLowerCase()}`}
                className="self-start rounded-md p-0 text-left font-display text-lg font-bold leading-tight text-foreground outline-none after:absolute after:inset-0 after:rounded-lg after:content-[''] focus-visible:after:ring-2 focus-visible:after:ring-ring"
              >
                {dayLabel}
              </button>
            ) : (
              <span className="font-display text-lg font-bold leading-tight text-foreground">{dayLabel}</span>
            )}
            <span className="relative z-10 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-foreground">
              <Clock3 className="h-[15px] w-[15px] text-primary-deep" aria-hidden="true" />
              Retiro {timeLabel} hs
              {canChangePickupTime && (
                <button
                  type="button"
                  onClick={() => onRequestChangePickupTime(order)}
                  aria-label={`Cambiar el horario de retiro del pedido del ${dayLabel.toLowerCase()}`}
                  className="-my-3 -ml-1 flex h-11 items-center gap-1.5 px-1.5 text-[13px] font-bold text-primary-deep"
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                  Cambiar horario
                </button>
              )}
            </span>
          </div>
          <OrderStatusBadge estado={order.estado} />
        </div>

        <div aria-hidden="true" className="mx-4 border-t border-dashed border-border" />

        <div className="flex flex-col gap-1.5 px-4 py-2.5">
          {order.items.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-2">
              <p className="m-0 text-[14.5px] leading-snug">
                <span className="font-semibold text-foreground">{item.dishNombre}</span>
                {item.sideNombre && (
                  <span className="text-muted-foreground"> · {item.sideNombre.toLowerCase()}</span>
                )}
              </p>
              {canRemoveItems && (
                <button
                  type="button"
                  onClick={() => onRequestRemoveItem(item)}
                  aria-label={`Quitar ${item.dishNombre}`}
                  className="relative flex h-11 w-11 shrink-0 items-center justify-center text-muted-foreground hover:text-destructive"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </div>
          ))}
          {order.notas && <p className="m-0 text-[13px] italic text-muted-foreground">{order.notas}</p>}
          {isCancelled && order.paidWithMercadoPago && (
            <p className="m-0 text-[13px] leading-relaxed text-muted-foreground">{MP_PAYMENT_CREDITED}</p>
          )}
          {isAwaitingPayment && (
            <p role="status" className="m-0 text-[13px] leading-relaxed text-muted-foreground">
              {payDeadlineText}
            </p>
          )}
        </div>

        <div aria-hidden="true" className="mx-4 border-t border-dashed border-border" />

        <div className="relative z-10 flex min-h-[48px] items-center justify-between gap-3 py-1 pl-4 pr-2">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 text-[13.5px] font-bold',
              isCancelled ? 'text-muted-foreground' : 'text-primary-deep',
            )}
          >
            <UtensilsCrossed className="h-[17px] w-[17px]" aria-hidden="true" />
            <span>{lunchesLabel}</span>
          </span>

          <span className="flex items-center gap-1">
            {isAwaitingPayment && order.cancellable && onRequestPayNow && (
              <button
                type="button"
                onClick={() => onRequestPayNow(order)}
                disabled={payingNow}
                className="flex h-11 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-bold uppercase tracking-brand text-primary-deep disabled:opacity-60"
              >
                <CreditCard className="h-[15px] w-[15px]" aria-hidden="true" />
                Pagar ahora
              </button>
            )}
            {order.cancellable && (
              <button
                type="button"
                onClick={onRequestCancel}
                className="flex h-11 items-center rounded-md px-2.5 text-[13px] font-bold uppercase tracking-brand text-destructive"
              >
                Cancelar pedido
              </button>
            )}
          </span>
        </div>
      </div>
    </li>
  );
}
