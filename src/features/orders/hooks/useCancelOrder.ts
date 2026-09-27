import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { cancelOrderV2 } from '../services/ordersApi';
import { formatLunches } from '../lunches';
import type { OrderV2 } from '../services/ordersApi';

/**
 * Cancelar un pedido v2 — mismo aviso de éxito e invalidaciones que ya
 * usaba "Mis pedidos" (F10: toast `Pedido cancelado · N almuerzo(s)
 * volvió/volvieron a tu saldo`, invalidación de `['ordersV2']` y
 * `['creditsWallet']`). Se extrae acá (F15) para que `B2cOrderPage`
 * ("Tu pedido para <día>") lo reutilice sin duplicar la lógica; `MyOrdersPage`
 * pasa a usar este mismo hook.
 */
export function useCancelOrder() {
  const queryClient = useQueryClient();
  const [cancelTarget, setCancelTarget] = useState<OrderV2 | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const cancelMutation = useMutation({
    // Se pasa el pedido completo como variable de la mutación (no solo el
    // id) para que `onSuccess` pueda leer su `creditTotal` de ahí, sin
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

  return {
    cancelTarget,
    cancelError,
    cancelling: cancelMutation.isPending,
    requestCancel: (order: OrderV2) => {
      setCancelTarget(order);
      setCancelError(null);
    },
    closeSheet: () => {
      setCancelTarget(null);
      setCancelError(null);
    },
    confirmCancel: () => {
      if (cancelTarget) cancelMutation.mutate(cancelTarget);
    },
  };
}
