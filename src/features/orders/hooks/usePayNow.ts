import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { DirectCheckoutNotResumableError, resumeDirectCheckoutV2 } from '../services/ordersApi';

/**
 * "Pagar ahora" sobre un pedido `PENDIENTE_PAGO` (F18, backend B7) — retoma
 * un pago directo abandonado. NUNCA crea un cobro nuevo: redirige al mismo
 * `initPoint` ya persistido. Si el pago dejó de poder retomarse (409 —
 * `order-not-awaiting-payment`/`direct-checkout-not-resumable`, p. ej. el
 * pedido ya se canceló o el pago ya se aprobó), avisa con un `toast` y
 * refetchea `['ordersV2']` para que la tarjeta muestre el estado real.
 */
export function usePayNow() {
  const queryClient = useQueryClient();

  const payMutation = useMutation({
    mutationFn: (orderId: number) => resumeDirectCheckoutV2(orderId),
    onSuccess: (checkout) => {
      window.location.href = checkout.initPoint;
    },
    onError: (err: unknown) => {
      toast.error(err instanceof DirectCheckoutNotResumableError ? err.message : 'No pudimos retomar el pago.');
      queryClient.invalidateQueries({ queryKey: ['ordersV2'] });
    },
  });

  return {
    payingOrderId: payMutation.isPending ? (payMutation.variables ?? null) : null,
    payNow: (orderId: number) => payMutation.mutate(orderId),
  };
}
