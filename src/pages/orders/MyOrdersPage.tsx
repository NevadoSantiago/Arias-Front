import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { OrderCard } from '@/features/orders/components/OrderCard';
import { useOrders } from '@/features/orders/hooks/useOrders';
import { cancelOrderV2 } from '@/features/orders/services/ordersApi';

/**
 * Ruta `/orders/mine` — "Mis pedidos" del cliente B2C (`GET /api/v2/orders`,
 * últimos 30, retiro más próximo primero, incluye cancelados). Cancelar es
 * la única acción y solo se ofrece cuando el backend reporta
 * `cancellable: true` — nunca se recalcula esa ventana en el cliente.
 * Cancelar refresca tanto esta lista como la billetera (`creditsWallet`),
 * para que el cliente vea sus almuerzos disponibles de nuevo.
 */
export function MyOrdersPage() {
  const queryClient = useQueryClient();
  const { data: orders, isLoading, isError } = useOrders();

  const cancelMutation = useMutation({
    mutationFn: cancelOrderV2,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ordersV2'] });
      queryClient.invalidateQueries({ queryKey: ['creditsWallet'] });
      toast.success('Pedido cancelado');
    },
    onError: () => {
      toast.error('No pudimos cancelar el pedido.');
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

  return (
    <div className="container py-8 space-y-6 max-w-2xl">
      <h1 className="font-display text-2xl font-bold text-foreground">Mis pedidos</h1>

      {!orders || orders.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-lg space-y-3">
          <p className="text-muted-foreground text-sm">Todavía no hiciste ningún pedido.</p>
          <Button asChild>
            <Link to="/orders/today">Hacer mi primer pedido</Link>
          </Button>
        </div>
      ) : (
        <ul className="space-y-4">
          {orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              cancelling={cancelMutation.isPending && cancelMutation.variables === order.id}
              onCancel={() => cancelMutation.mutate(order.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
