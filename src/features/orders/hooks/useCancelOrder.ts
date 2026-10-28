import { useState } from 'react';
import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PENDING_PURCHASES_KEY } from '@/features/credits/hooks/usePendingPurchases';
import { refundDeadlineLabel } from '../cancellation';
import { cancelOrderV2, getOrdersV2, OrderCancelError } from '../services/ordersApi';
import { balancePartOf, formatLunches, PENDING_PAYMENT_CREDITED_TOAST } from '../lunches';
import type { OrderV2 } from '../services/ordersApi';
import type { OrderNotice } from '../orderNotice';

/**
 * Lee del backend si el pedido recién cancelado devolvió los almuerzos (`true`), los consumió (`false`)
 * o no se sabe (`null`: el backend no lo informa, no encontramos el pedido o la lectura falló).
 */
async function readCancelRefunded(queryClient: QueryClient, orderId: number): Promise<boolean | null> {
  try {
    const orders = await queryClient.fetchQuery({ queryKey: ['ordersV2'], queryFn: getOrdersV2, staleTime: 0 });
    return orders.find((o) => o.id === orderId)?.cancelRefunded ?? null;
  } catch {
    return null;
  }
}

/**
 * Cancelar un pedido v2 — mismo aviso de éxito e invalidaciones que ya
 * usaba "Mis pedidos" (F10: toast `Pedido cancelado · N almuerzo(s)
 * volvió/volvieron a tu saldo`, invalidación de `['ordersV2']` y
 * `['creditsWallet']`). Se extrae acá (F15) para que `B2cOrderPage`
 * ("Tu pedido para <día>") lo reutilice sin duplicar la lógica; `MyOrdersPage`
 * pasa a usar este mismo hook.
 *
 * F29: con `onNotice`, "Mis pedidos" recibe el aviso de éxito (en vez del
 * toast) para mostrarlo en la página; sin él, todo queda como antes.
 */
export function useCancelOrder({ onNotice }: { onNotice?: (notice: OrderNotice, order: OrderV2) => void } = {}) {
  const queryClient = useQueryClient();
  const [cancelTarget, setCancelTarget] = useState<OrderV2 | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const cancelMutation = useMutation({
    // Se pasa el pedido completo como variable de la mutación (no solo el
    // id) para que `onSuccess` pueda leer su `creditTotal` de ahí, sin
    // depender de `cancelTarget` (estado de React), que puede haber
    // cambiado o quedar en null para cuando la mutación resuelve.
    mutationFn: (order: OrderV2) => cancelOrderV2(order.id),
    // DELETE devuelve 204 sin cuerpo: el resultado (almuerzos devueltos o cobrados) se lee del pedido en el backend.
    onSuccess: async (_data, order) => {
      const refunded = await readCancelRefunded(queryClient, order.id);
      queryClient.invalidateQueries({ queryKey: ['ordersV2'] });
      queryClient.invalidateQueries({ queryKey: ['creditsWallet'] });
      // D6: cancelar cambia el aviso de pagos pendientes de "Mis almuerzos" (el pedido pasa a CANCELADO).
      queryClient.invalidateQueries({ queryKey: PENDING_PURCHASES_KEY });
      if (refunded === false) {
        // Cancelación tardía: el pedido se cancela igual pero los almuerzos se consumen.
        const count = order.creditTotal;
        const deadline = refundDeadlineLabel(order);
        const charged = count === 1 ? 'el almuerzo se cobró' : `los ${count} almuerzos se cobraron`;
        if (onNotice) {
          onNotice(
            {
              title: 'Pedido cancelado',
              text: `Ya había pasado el límite${deadline ? ` de las ${deadline}` : ''}, así que ${charged} igual.`,
              tone: 'warning',
            },
            order,
          );
        } else {
          toast.success(`Pedido cancelado · ${formatLunches(count)} ${count === 1 ? 'consumido' : 'consumidos'}`);
        }
        setCancelTarget(null);
        setCancelError(null);
        return;
      }
      if (refunded === null) {
        // El backend no lo informa (o no pudimos leerlo): no afirmamos ni devolución ni cobro.
        const credited = order.estado === 'PENDIENTE_PAGO' ? PENDING_PAYMENT_CREDITED_TOAST : null;
        if (onNotice) onNotice({ title: 'Pedido cancelado', text: credited ?? 'Revisá tu saldo para ver cómo quedó.' }, order);
        else toast.success(credited ? `Pedido cancelado. ${credited}` : 'Pedido cancelado');
        setCancelTarget(null);
        setCancelError(null);
        return;
      }
      // Un pedido esperando pago solo devuelve los almuerzos que reservó del saldo (F23).
      const count = order.estado === 'PENDIENTE_PAGO' ? balancePartOf(order) : order.creditTotal;
      const returned = count === 0 ? null : `${formatLunches(count)} ${count === 1 ? 'volvió' : 'volvieron'} a tu saldo`;
      // F26: si ya había pagado, Mercado Pago lo confirma después y el pago se acredita al saldo.
      const credited = order.estado === 'PENDIENTE_PAGO' ? PENDING_PAYMENT_CREDITED_TOAST : null;
      if (onNotice) {
        // F29: "Mis pedidos" muestra el aviso arriba de la página, no un toast.
        const text = [returned && `${returned}.`, credited].filter(Boolean).join(' ');
        onNotice({ title: 'Pedido cancelado', text: text || 'No se usó ningún almuerzo de tu saldo.' }, order);
      } else {
        const base = returned ? `Pedido cancelado · ${returned}` : 'Pedido cancelado';
        toast.success(credited ? `${base}. ${credited}` : base);
      }
      setCancelTarget(null);
      setCancelError(null);
    },
    onError: (err) => {
      setCancelError(err instanceof OrderCancelError ? err.message : 'No pudimos cancelar el pedido.');
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
