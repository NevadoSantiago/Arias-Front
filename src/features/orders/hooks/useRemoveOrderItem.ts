import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { OrderNotModifiableError, removeOrderItemV2 } from '../services/ordersApi';
import type { OrderItemV2, OrderV2 } from '../services/ordersApi';
import type { OrderNotice } from '../orderNotice';
import { formatLunches } from '../lunches';
import type { RemoveOrderItemTarget } from '../components/RemoveOrderItemSheet';

/**
 * Quitar un plato de un pedido v2 modificable — abre el modal de
 * confirmación (F16, pedido del usuario), llama
 * `DELETE /api/v2/orders/{id}/items/{itemId}` y avisa si era el único plato
 * del pedido (el backend lo cancela y devuelve `estado: 'CANCELADO'`).
 * Mismo patrón que `useCancelOrder`: invalida `['ordersV2']` y
 * `['creditsWallet']`, y la hoja se mantiene abierta mientras la mutación
 * está en curso. Con `onNotice` (F29) el aviso de éxito lo muestra "Mis pedidos"
 * en la fila (o arriba, si era el último plato y el pedido se canceló) en lugar
 * del toast.
 */
export function useRemoveOrderItem({
  onNotice,
}: { onNotice?: (notice: OrderNotice, result: { order: OrderV2; orderCancelled: boolean }) => void } = {}) {
  const queryClient = useQueryClient();
  const [removeTarget, setRemoveTarget] = useState<RemoveOrderItemTarget | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const removeMutation = useMutation({
    mutationFn: (target: RemoveOrderItemTarget) => removeOrderItemV2(target.order.id, target.item.id),
    onSuccess: (updatedOrder, target) => {
      queryClient.invalidateQueries({ queryKey: ['ordersV2'] });
      queryClient.invalidateQueries({ queryKey: ['creditsWallet'] });
      const orderCancelled = updatedOrder.estado === 'CANCELADO';
      if (onNotice) {
        // F29: "Mis pedidos" muestra el aviso en la fila (o arriba, si el pedido se canceló), no un toast.
        const cost = target.item.creditCost;
        // Un plato de 0 almuerzos no devuelve nada: no se dice "0 almuerzos volvieron".
        const returned = cost > 0 ? ` ${formatLunches(cost)} ${cost === 1 ? 'volvió' : 'volvieron'} a tu saldo.` : '';
        onNotice(
          orderCancelled
            ? { title: 'Pedido cancelado', text: `Quitaste el único plato y se canceló el pedido.${returned}` }
            : { title: 'Plato quitado', text: `${target.item.dishNombre} ya no está en tu pedido.${returned}` },
          { order: target.order, orderCancelled },
        );
      } else if (orderCancelled) {
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
