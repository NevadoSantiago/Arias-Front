import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { OrderCard } from '../OrderCard';
import type { OrderV2 } from '../../services/ordersApi';

interface Props {
  /** Pedidos NO cancelados del día seleccionado — el filtrado lo hace la página. */
  orders: OrderV2[];
  /** "hoy" o el día corto (mismo texto que usa el botón de confirmar, p. ej. "lunes 29"). */
  dayHeadingLabel: string;
  now: Date;
  onRequestCancel: (order: OrderV2) => void;
}

/**
 * "Tu pedido para <día>" (F15) — pedido del usuario: un día con pedido
 * programado no mostraba forma de verlo ni modificarlo. No hay endpoint de
 * edición de pedidos v2 (solo cancelar), así que la acción es cancelar y
 * armar uno nuevo con el menú, que sigue disponible debajo.
 *
 * Reutiliza `OrderCard` tal cual (mismo lenguaje visual que "Mis pedidos"):
 * ya trae el badge de estado, el reloj con el horario, los platos con
 * guarnición/notas y los almuerzos usados, y solo ofrece "Cancelar pedido"
 * cuando `order.cancellable` es `true` (el backend decide esa ventana).
 */
export function SelectedDayOrders({ orders, dayHeadingLabel, now, onRequestCancel }: Props) {
  if (orders.length === 0) return null;

  const heading =
    orders.length > 1 ? `Tus pedidos para ${dayHeadingLabel}` : `Tu pedido para ${dayHeadingLabel}`;
  const someCancellable = orders.some((order) => order.cancellable);

  return (
    <section data-testid="selected-day-orders" className="mb-6 space-y-3">
      <h2 className="font-display text-foreground text-lg font-bold">{heading}</h2>
      <ul className="space-y-2">
        {orders.map((order) => (
          <Fragment key={order.id}>
            <OrderCard order={order} now={now} onRequestCancel={() => onRequestCancel(order)} />
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
      {someCancellable && (
        <p className="text-xs text-muted-foreground">¿Querés cambiar algo? Cancelalo y armá uno nuevo.</p>
      )}
    </section>
  );
}
