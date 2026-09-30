import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { OrderCard } from '../OrderCard';
import type { OrderItemV2, OrderV2 } from '../../services/ordersApi';

interface Props {
  /** Pedidos NO cancelados del día seleccionado — el filtrado lo hace la página. */
  orders: OrderV2[];
  /** "hoy" o el día corto (mismo texto que usa el botón de confirmar, p. ej. "lunes 29"). */
  dayHeadingLabel: string;
  now: Date;
  onRequestCancel: (order: OrderV2) => void;
  /** Optativo (F16) — ver `OrderCard.onRequestRemoveItem`; sin esta prop no aparece ninguna "×". */
  onRequestRemoveItem?: (order: OrderV2, item: OrderItemV2) => void;
  /** F18 — ver `OrderCard.pickupLeadMinutes`. */
  pickupLeadMinutes?: number | null;
  /** F18 — ver `OrderCard.onRequestPayNow`; sin esta prop no aparece "Pagar ahora". */
  onRequestPayNow?: (order: OrderV2) => void;
  /** F18 — id del pedido cuyo "Pagar ahora" está en curso (deshabilita SU botón). */
  payingOrderId?: number | null;
}

/**
 * "Tu pedido para <día>" (F15) — pedido del usuario: un día con pedido
 * programado no mostraba forma de verlo ni modificarlo. Agregar platos al
 * pedido lo decide el horario elegido en la hoja de revisión (F21); acá solo
 * se explica la regla.
 *
 * Reutiliza `OrderCard` tal cual (mismo lenguaje visual que "Mis pedidos"):
 * ya trae el badge de estado, el reloj con el horario, los platos con
 * guarnición/notas y los almuerzos usados, y solo ofrece "Cancelar pedido"
 * cuando `order.cancellable` es `true` (el backend decide esa ventana).
 */
export function SelectedDayOrders({
  orders,
  dayHeadingLabel,
  now,
  onRequestCancel,
  onRequestRemoveItem,
  pickupLeadMinutes,
  onRequestPayNow,
  payingOrderId,
}: Props) {
  if (orders.length === 0) return null;

  const heading =
    orders.length > 1 ? `Tus pedidos para ${dayHeadingLabel}` : `Tu pedido para ${dayHeadingLabel}`;
  // Aviso según la regla de pedidos del mismo día (prototipo): con un pedido
  // modificable, el mismo horario suma; si sólo hay uno esperando el pago,
  // lo que se pida va en un pedido nuevo.
  const someModifiable = orders.some((order) => order.modifiable);
  const someAwaitingPayment = orders.some((order) => order.estado === 'PENDIENTE_PAGO');

  return (
    <section data-testid="selected-day-orders" className="mb-6 space-y-3">
      <h2 className="font-display text-foreground text-lg font-bold">{heading}</h2>
      <ul className="space-y-2">
        {orders.map((order) => (
          <Fragment key={order.id}>
            <OrderCard
              order={order}
              now={now}
              onRequestCancel={() => onRequestCancel(order)}
              onRequestRemoveItem={
                onRequestRemoveItem ? (item) => onRequestRemoveItem(order, item) : undefined
              }
              pickupLeadMinutes={pickupLeadMinutes}
              onRequestPayNow={onRequestPayNow}
              payingNow={payingOrderId === order.id}
            />
            <li>
              <Link
                to="/orders/mine"
                className="inline-flex h-8 items-center pl-1 text-[13px] font-semibold text-primary-deep underline underline-offset-2"
              >
                Ver en Mis pedidos
              </Link>
            </li>
          </Fragment>
        ))}
      </ul>
      {someModifiable ? (
        <p className="text-xs text-muted-foreground">
          Si elegís el mismo horario, lo que pidas se suma a ese pedido. Con otro horario, armás un pedido nuevo.
        </p>
      ) : (
        someAwaitingPayment && (
          <p className="text-xs text-muted-foreground">
            Ese pedido espera el pago, así que lo que pidas ahora va en un pedido nuevo.
          </p>
        )
      )}
    </section>
  );
}
