import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CancelOrderSheet } from '@/features/orders/components/CancelOrderSheet';
import { ChangePickupTimeSheet } from '@/features/orders/components/ChangePickupTimeSheet';
import { OrderCard } from '@/features/orders/components/OrderCard';
import { isRestaurantDayOnOrAfter } from '@/features/orders/components/orderDateLabels';
import { useCancelOrder } from '@/features/orders/hooks/useCancelOrder';
import { useChangePickupTime } from '@/features/orders/hooks/useChangePickupTime';
import { useOrders } from '@/features/orders/hooks/useOrders';
import { usePayNow } from '@/features/orders/hooks/usePayNow';
import { getRestaurantConfig, type OrderV2 } from '@/features/orders/services/ordersApi';

/**
 * Ruta `/orders/mine` — "Mis pedidos" del cliente B2C (`GET /api/v2/orders`,
 * últimos 30, retiro más próximo primero, incluye cancelados). Cancelar es
 * la única acción y solo se ofrece cuando el backend reporta
 * `cancellable: true` — nunca se recalcula esa ventana en el cliente.
 * Cancelar refresca tanto esta lista como la billetera (`creditsWallet`),
 * para que el cliente vea sus almuerzos disponibles de nuevo.
 *
 * F10 (prototipo `MyOrders.dc.html`): los pedidos se agrupan en "Próximos"
 * (retiro >= ahora, ascendente — un pedido futuro cancelado sigue acá) y
 * "Anteriores" (retiro < ahora, descendente). "ahora" se calcula una vez
 * por carga de datos, no en cada render, para que la lista no salte de
 * grupo sola mientras el usuario la mira.
 *
 * Cancelar (hoja de confirmación, toast e invalidaciones) usa `useCancelOrder`
 * — extraído en F15 para que `B2cOrderPage` ("Tu pedido para <día>") lo
 * reutilice sin duplicar la lógica.
 *
 * F17, pedido del usuario: por defecto solo se muestran los próximos
 * programados (PENDIENTE con retiro >= ahora) y los confirmados de HOY EN
 * ADELANTE (CONFIRMADO cuyo día de retiro es hoy o un día posterior en la
 * zona del restaurante, `isRestaurantDayOnOrAfter` — corrección de revisión:
 * un CONFIRMADO con retiro futuro no debía caer en "Anteriores"). Todo lo
 * demás — pasados y cancelados (incluso futuros) — queda oculto detrás de
 * "Ver pedidos anteriores", que revela la sección "Anteriores" de siempre.
 * `PENDIENTE_PAGO` (F18) sigue la misma regla que CONFIRMADO —
 * `isRestaurantDayOnOrAfter` — porque el corte de pago es independiente del
 * horario de retiro: un "Pago pendiente" de hoy cuenta como próximo aunque
 * su horario ya haya pasado.
 */
export function MyOrdersPage() {
  const { data: orders, isLoading, isError } = useOrders();
  const now = useMemo(() => new Date(), [orders]);
  const [showPast, setShowPast] = useState(false);
  const { cancelTarget, cancelError, cancelling, requestCancel, closeSheet, confirmCancel } =
    useCancelOrder();
  const { changeTarget, changeError, changing, requestChange, closeChangeSheet, confirmChange } =
    useChangePickupTime();
  const { payingOrderId, payNow } = usePayNow();
  /**
   * `pickupLeadMinutes` para el aviso de corte de "Pago pendiente" (F18) —
   * la misma config pública que ya usa `B2cOrderPage`. Tolerante a que no
   * cargue todavía: `OrderCard` omite el horario del aviso en ese caso.
   */
  const { data: restaurantConfig } = useQuery({
    queryKey: ['restaurantConfig'],
    queryFn: getRestaurantConfig,
  });

  if (isLoading) {
    return (
      <div className="container py-12">
        <p className="text-center text-muted-foreground text-sm uppercase tracking-brand">
          Cargando…
        </p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="container py-12">
        <p className="text-center text-destructive text-sm">No pudimos cargar tus pedidos.</p>
      </div>
    );
  }

  const hasOrders = !!orders && orders.length > 0;

  const isDefaultUpcoming = (order: OrderV2): boolean => {
    if (order.estado === 'PENDIENTE') {
      return new Date(order.pickupAt).getTime() >= now.getTime();
    }
    if (order.estado === 'CONFIRMADO' || order.estado === 'PENDIENTE_PAGO') {
      return isRestaurantDayOnOrAfter(order.pickupAt, now);
    }
    return false;
  };

  const upcoming = hasOrders
    ? orders
        .filter(isDefaultUpcoming)
        .sort((a, b) => new Date(a.pickupAt).getTime() - new Date(b.pickupAt).getTime())
    : [];
  const past = hasOrders
    ? orders
        .filter((order) => !isDefaultUpcoming(order))
        .sort((a, b) => new Date(b.pickupAt).getTime() - new Date(a.pickupAt).getTime())
    : [];
  const hasUpcoming = upcoming.length > 0;
  const hasPast = past.length > 0;

  return (
    <div className="container max-w-2xl space-y-6 py-8">
      <h1 className="font-display text-2xl font-bold text-foreground">Mis pedidos</h1>

      {!hasOrders ? (
        <div className="space-y-3 rounded-lg border border-dashed border-border py-16 text-center">
          <p className="text-sm text-muted-foreground">Todavía no hiciste ningún pedido</p>
          <Link
            to="/orders/today"
            className="mx-auto flex h-11 w-fit items-center rounded-md bg-primary-deep px-5 text-sm font-bold uppercase tracking-brand text-primary-foreground no-underline"
          >
            Hacer mi primer pedido
          </Link>
        </div>
      ) : (
        <>
          {hasUpcoming ? (
            <section className="space-y-3">
              <header className="flex items-baseline justify-between">
                <h2 className="text-[11px] font-semibold uppercase tracking-brand text-muted-foreground">
                  Próximos
                </h2>
                <span className="text-xs font-bold text-muted-foreground">{upcoming.length}</span>
              </header>
              <ul className="space-y-3">
                {upcoming.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    now={now}
                    onRequestCancel={() => requestCancel(order)}
                    pickupLeadMinutes={restaurantConfig?.pickupLeadMinutes}
                    onRequestPayNow={(o) => payNow(o.id)}
                    payingNow={payingOrderId === order.id}
                    onRequestChangePickupTime={requestChange}
                  />
                ))}
              </ul>
            </section>
          ) : (
            <div className="space-y-3 rounded-lg border border-dashed border-border py-16 text-center">
              <p className="text-sm text-muted-foreground">No tenés pedidos próximos</p>
              <Link
                to="/orders/today"
                className="mx-auto flex h-11 w-fit items-center rounded-md bg-primary-deep px-5 text-sm font-bold uppercase tracking-brand text-primary-foreground no-underline"
              >
                Hacer un pedido
              </Link>
            </div>
          )}

          {hasPast && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => setShowPast((current) => !current)}
                className="h-11 px-2 text-xs font-bold uppercase tracking-brand text-primary-deep"
              >
                {showPast ? 'Ocultar pedidos anteriores' : 'Ver pedidos anteriores'}
              </button>
            </div>
          )}

          {showPast && (
            <section className="space-y-3">
              <header className="flex items-baseline justify-between">
                <h2 className="text-[11px] font-semibold uppercase tracking-brand text-muted-foreground">
                  Anteriores
                </h2>
                <span className="text-xs font-bold text-muted-foreground">{past.length}</span>
              </header>
              <ul className="space-y-3">
                {past.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    now={now}
                    onRequestCancel={() => requestCancel(order)}
                    pickupLeadMinutes={restaurantConfig?.pickupLeadMinutes}
                    onRequestPayNow={(o) => payNow(o.id)}
                    payingNow={payingOrderId === order.id}
                  />
                ))}
              </ul>
            </section>
          )}

          <p className="text-center text-xs text-muted-foreground">Mostramos tus últimos 30 pedidos.</p>
        </>
      )}

      <CancelOrderSheet
        order={cancelTarget}
        now={now}
        cancelling={cancelling}
        errorMessage={cancelError}
        onConfirm={confirmCancel}
        onClose={closeSheet}
      />

      <ChangePickupTimeSheet
        order={changeTarget}
        changing={changing}
        errorMessage={changeError}
        onConfirm={confirmChange}
        onClose={closeChangeSheet}
      />
    </div>
  );
}
