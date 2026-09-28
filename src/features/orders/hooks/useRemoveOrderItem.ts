import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { OrderNotModifiableError, removeOrderItemV2 } from '../services/ordersApi';
import type { OrderItemV2, OrderV2 } from '../services/ordersApi';
import type { RemoveOrderItemTarget } from '../components/RemoveOrderItemSheet';

/**
 * Quitar un plato de un pedido v2 modificable — abre el modal de
 * confirmación (F16, pedido del usuario), llama
 * `DELETE /api/v2/orders/{id}/items/{itemId}` y avisa si era el único plato
 * del pedido (el backend lo cancela y devuelve `estado: 'CANCELADO'`).
 * Mismo patrón que `useCancelOrder`: invalida `['ordersV2']` y
 * `['creditsWallet']`, y la hoja se mantiene abierta mientras la mutación
 * está en curso.
 */
export function useRemoveOrderItem() {
  const queryClient = useQueryClient();
  const [removeTarget, setRemoveTarget] = useState<RemoveOrderItemTarget | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const removeMutation = useMutation({
    mutationFn: (target: RemoveOrderItemTarget) => removeOrderItemV2(target.order.id, target.item.id),
    onSuccess: (updatedOrder, target) => {
      queryClient.invalidateQueries({ queryKey: ['ordersV2'] });
      queryClient.invalidateQueries({ queryKey: ['creditsWallet'] });
      if (updatedOrder.estado === 'CANCELADO') {
        toast.success('Pedido cancelado');
      } else {
        toast.success(`Quitamos ${target.item.dishNombre}`);
      }
      setRemoveTarget(null);
      setRemoveError(null);
    },
    onError: (err: unknown) => {
      setRemoveError(err instanceof OrderNotModifiableError ? err.message : 'No pudimos quitar el plato.');
    },
  });

  return {
    removeTarget,
    removeError,
    removing: removeMutation.isPending,
    requestRemoveItem: (order: OrderV2, item: OrderItemV2) => {
      setRemoveTarget({ order, item });
      setRemoveError(null);
    },
    closeRemoveSheet: () => {
      setRemoveTarget(null);
      setRemoveError(null);
    },
    confirmRemoveItem: () => {
      if (removeTarget) removeMutation.mutate(removeTarget);
    },
  };
}
