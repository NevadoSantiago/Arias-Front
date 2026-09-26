import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CancelOrderSheet } from '@/features/orders/components/CancelOrderSheet';
import { OrderCard } from '@/features/orders/components/OrderCard';
import { useOrders } from '@/features/orders/hooks/useOrders';
import { cancelOrderV2 } from '@/features/orders/services/ordersApi';
import { formatLunches } from '@/features/orders/lunches';
import type { OrderV2 } from '@/features/orders/services/ordersApi';

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
 */
export function MyOrdersPage() {
  const queryClient = useQueryClient();
  const { data: orders, isLoading, isError } = useOrders();
  const [cancelTarget, setCancelTarget] = useState<OrderV2 | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const now = useMemo(() => new Date(), [orders]);

  const cancelMutation = useMutation({
    // Se pasa el pedido completo como variable de la mutación (no solo el
    // id) para que `onSuccess` pueda leer su `creditTotal` de ahí en vez de
    // depender de `cancelTarget` (estado de React), que puede haber
    // cambiado o quedar en null para cuando la mutación resuelve.
    mutationFn: (order: OrderV2) => cancelOrderV2(order.id),
    onSuccess: (_data, order) => {
      queryClient.invalidateQueries({ queryKey: ['ordersV2'] });
      queryClient.invalidateQueries({ queryKey: ['creditsWallet'] });
      const count = order.creditTotal;
      toast.success(
        `Pedido cancelado · ${formatLunches(count)} ${count === 1 ? 'volvió' : 'volvieron'} a tu saldo`,
      );
      setCancelTarget(null);
      setCancelError(null);
    },
    onError: () => {
      setCancelError('No pudimos cancelar el pedido.');
    },
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

  function requestCancel(order: OrderV2) {
    setCancelTarget(order);
    setCancelError(null);
  }

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
        cancelling={cancelMutation.isPending}
        errorMessage={cancelError}
        onConfirm={() => cancelTarget && cancelMutation.mutate(cancelTarget)}
        onClose={() => {
          setCancelTarget(null);
          setCancelError(null);
        }}
      />
    </div>
  );
}
