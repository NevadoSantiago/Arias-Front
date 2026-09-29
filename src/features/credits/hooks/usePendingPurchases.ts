import { useQuery } from '@tanstack/react-query';
import { getPendingPurchases } from '../services/creditsApi';

/** Clave compartida: quien cambia una compra o un pedido la invalida para que el aviso de "Mis almuerzos" se ponga al día. */
export const PENDING_PURCHASES_KEY = ['creditsPendingPurchases'] as const;

/**
 * Pagos de Mercado Pago pendientes del usuario (D6). Solo informa: nunca se
 * suman al saldo disponible, y si falla el aviso simplemente no se muestra.
 */
export function usePendingPurchases() {
  return useQuery({
    queryKey: PENDING_PURCHASES_KEY,
    queryFn: getPendingPurchases,
  });
}
