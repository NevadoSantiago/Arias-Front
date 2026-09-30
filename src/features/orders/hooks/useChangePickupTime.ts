import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { changeOrderPickupTimeV2, PickupTimeChangeError } from '../services/ordersApi';
import { formatOrderDayLabel, formatOrderTimeLabel } from '../components/orderDateLabels';
import type { OrderV2 } from '../services/ordersApi';
import type { OrderNotice } from '../orderNotice';

/**
 * Cambiar el horario de retiro de un pedido programado (F19) — abre la hoja
 * en dos pasos, llama `PATCH /api/v2/orders/{id}/pickup-time` y refresca los
 * pedidos. Mismo patrón que `useCancelOrder`: la hoja se mantiene abierta
 * mientras la mutación está en curso y, si el backend rechaza el cambio,
 * muestra su mensaje. No toca la billetera: los almuerzos no cambian.
 * Con `onNotice` (F29) el aviso de éxito lo muestra la página en lugar del toast.
 */
export function useChangePickupTime({ onNotice }: { onNotice?: (notice: OrderNotice, order: OrderV2) => void } = {}) {
  const queryClient = useQueryClient();
  const [changeTarget, setChangeTarget] = useState<OrderV2 | null>(null);
  const [changeError, setChangeError] = useState<string | null>(null);

  const changeMutation = useMutation({
    mutationFn: ({ order, pickupAt }: { order: OrderV2; pickupAt: string }) =>
      changeOrderPickupTimeV2(order.id, pickupAt),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['ordersV2'] });
      const day = formatOrderDayLabel(updated.pickupAt, new Date()).toLowerCase();
      const when = day.startsWith('hoy') ? 'hoy' : `el ${day}`;
      const text = `Retirás tu pedido ${when} a las ${formatOrderTimeLabel(updated.pickupAt)} hs.`;
      // F29: "Mis pedidos" muestra el aviso dentro de la fila del pedido, no un toast.
      if (onNotice) onNotice({ title: 'Horario cambiado', text }, updated);
      else toast.success('Horario cambiado', { description: text });
      setChangeTarget(null);
      setChangeError(null);
    },
    onError: (err: unknown) => {
      setChangeError(err instanceof PickupTimeChangeError ? err.message : 'No pudimos cambiar el horario de retiro.');
    },
  });

  return {
    changeTarget,
    changeError,
    changing: changeMutation.isPending,
    requestChange: (order: OrderV2) => {
      setChangeTarget(order);
      setChangeError(null);
    },
    closeChangeSheet: () => {
      setChangeTarget(null);
      setChangeError(null);
    },
    confirmChange: (pickupAt: string) => {
      if (changeTarget) changeMutation.mutate({ order: changeTarget, pickupAt });
    },
  };
}
