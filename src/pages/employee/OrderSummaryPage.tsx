import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { OrderSummary } from '@/features/orders/components/OrderSummary';
import {
  cancelOrder,
  getRestaurantConfig,
  getTodayOrder,
} from '@/features/orders/services/ordersApi';
import { useAuthStore } from '@/features/auth/store/authStore';
import { orderFlowPaths } from '@/features/orders/orderFlowPaths';

/**
 * Vista dedicada a la comanda del pedido del día.
 * Si no hay pedido, redirige al inicio (donde el empleado puede crear uno).
 */
export function OrderSummaryPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const paths = orderFlowPaths(user?.role);

  const { data: config } = useQuery({ queryKey: ['restaurantConfig'], queryFn: getRestaurantConfig });
  const { data: order, isLoading } = useQuery({
    queryKey: ['todayOrder'],
    queryFn: getTodayOrder,
  });

  // Si no hay pedido para hoy, volver al inicio
  useEffect(() => {
    if (!isLoading && !order) {
      navigate(paths.today, { replace: true });
    }
  }, [isLoading, order, navigate]);

  const cancelMutation = useMutation({
    mutationFn: () => cancelOrder(),
    onSuccess: () => {
      queryClient.setQueryData(['todayOrder'], null);
      queryClient.invalidateQueries({ queryKey: ['availableDishes'] });
      queryClient.invalidateQueries({ queryKey: ['weekOrders'] });
      navigate(paths.today, { replace: true });
    },
  });

  if (isLoading || !order || !config || !user) {
    return (
      <div className="container py-12">
        <p className="text-center text-muted-foreground text-sm uppercase tracking-brand">
          Cargando…
        </p>
      </div>
    );
  }

  return (
    <OrderSummary
      order={order}
      cutoffTime={config.horaCorte}
      companyName={user.companyName ?? ''}
      onBackToMenu={() => navigate(paths.today)}
      // "Modificar" lleva al menú para que el usuario elija otro plato.
      // El backend recibe un PUT y reemplaza la selección (no cancela el pedido).
      onEdit={() => navigate(paths.today)}
      onCancel={() => cancelMutation.mutateAsync()}
    />
  );
}
