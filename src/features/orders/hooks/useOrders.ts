import { useQuery } from '@tanstack/react-query';
import { getOrdersV2 } from '../services/ordersApi';

/**
 * Pedidos del cliente autenticado (camino nuevo por créditos) — últimos 30,
 * retiro más próximo primero, incluye cancelados. Usado por la pantalla
 * "Mis pedidos".
 */
export function useOrders() {
  return useQuery({
    queryKey: ['ordersV2'],
    queryFn: getOrdersV2,
  });
}
