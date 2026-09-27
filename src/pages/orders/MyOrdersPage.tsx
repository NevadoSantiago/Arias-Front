import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { CancelOrderSheet } from '@/features/orders/components/CancelOrderSheet';
import { OrderCard } from '@/features/orders/components/OrderCard';
import { useCancelOrder } from '@/features/orders/hooks/useCancelOrder';
import { useOrders } from '@/features/orders/hooks/useOrders';

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
 */
export function MyOrdersPage() {
  const { data: orders, isLoading, isError } = useOrders();
  const now = useMemo(() => new Date(), [orders]);
  const { cancelTarget, cancelError, cancelling, requestCancel, closeSheet, confirmCancel } =
    useCancelOrder();

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
  const upcoming = hasOrders
    ? orders
        .filter((order) => new Date(order.pickupAt).getTime() >= now.getTime())
        .sort((a, b) => new Date(a.pickupAt).getTime() - new Date(b.pickupAt).getTime())
    : [];
  const past = hasOrders
    ? orders
        .filter((order) => new Date(order.pickupAt).getTime() < now.getTime())
        .sort((a, b) => new Date(b.pickupAt).getTime() - new Date(a.pickupAt).getTime())
    : [];

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
                />
              ))}
            </ul>
          </section>

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
                />
              ))}
            </ul>
          </section>

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
    </div>
  );
}
