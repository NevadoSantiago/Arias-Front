import { Clock3, UtensilsCrossed } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatLunches } from '../lunches';
import { formatOrderDayLabel, formatOrderTimeLabel } from './orderDateLabels';
import { OrderStatusBadge } from './OrderStatusBadge';
import type { OrderV2 } from '../services/ordersApi';

interface Props {
  order: OrderV2;
  /** Instante de referencia para el prefijo "Hoy, " — se calcula una vez por carga de datos en la página. */
  now: Date;
  onRequestCancel: () => void;
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
export function OrderCard({ order, now, onRequestCancel }: Props) {
  const dayLabel = formatOrderDayLabel(order.pickupAt, now);
  const timeLabel = formatOrderTimeLabel(order.pickupAt);
  const isCancelled = order.estado === 'CANCELADO';

  return (
    // data-testid: la tarjeta y sus ítems son ambos <li>, así que el rol
    // "listitem" no alcanza para distinguir un pedido de sus platos.
    <li data-testid="order-card">
      <div
        className={cn(
          'overflow-hidden rounded-lg border border-border bg-card',
          isCancelled && 'opacity-80',
        )}
      >
        <div className="flex items-start justify-between gap-3 p-4 pb-3">
          <div className="flex flex-col gap-1">
            <span className="font-display text-lg font-bold leading-tight text-foreground">{dayLabel}</span>
            <span className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-foreground">
              <Clock3 className="h-[15px] w-[15px] text-primary-deep" aria-hidden="true" />
              Retiro {timeLabel} hs
            </span>
          </div>
          <OrderStatusBadge estado={order.estado} />
        </div>

        <div aria-hidden="true" className="mx-4 border-t border-dashed border-border" />

        <div className="flex flex-col gap-1.5 px-4 py-2.5">
          {order.items.map((item) => (
            <p key={item.id} className="m-0 text-[14.5px] leading-snug">
              <span className="font-semibold text-foreground">{item.dishNombre}</span>
              {item.sideNombre && (
                <span className="text-muted-foreground"> · {item.sideNombre.toLowerCase()}</span>
              )}
            </p>
          ))}
          {order.notas && <p className="m-0 text-[13px] italic text-muted-foreground">{order.notas}</p>}
        </div>

        <div aria-hidden="true" className="mx-4 border-t border-dashed border-border" />

        <div className="flex min-h-[48px] items-center justify-between gap-3 py-1 pl-4 pr-2">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 text-[13.5px] font-bold',
              isCancelled ? 'text-muted-foreground' : 'text-primary-deep',
            )}
          >
            <UtensilsCrossed className="h-[17px] w-[17px]" aria-hidden="true" />
            <span>{formatLunches(order.creditTotal)}</span>
          </span>

          {order.cancellable && (
            <button
              type="button"
              onClick={onRequestCancel}
              className="flex h-11 items-center rounded-md px-2.5 text-[13px] font-bold uppercase tracking-brand text-destructive"
            >
              Cancelar pedido
            </button>
          )}
        </div>
      </div>
    </li>
  );
}
