import { usePayNow } from '@/features/orders/hooks/usePayNow';
import { usePackCatalog } from '../hooks/usePackPurchase';
import { usePendingPurchases } from '../hooks/usePendingPurchases';
import { PendingPurchasesNotice } from './PendingPurchasesNotice';

/**
 * Contenedor del aviso de pagos pendientes (D6): pide la lista, y sin datos
 * (cargando, con error o vacía) no dibuja nada: un fallo es silencioso y no
 * bloquea la página. "Pagar ahora" reusa `usePayNow` (retoma el checkout ya
 * persistido del pedido, nunca crea un cobro nuevo).
 */
export function PendingPurchases({ variant = 'card' }: { variant?: 'card' | 'wide' }) {
  const { data: purchases } = usePendingPurchases();
  const { payingOrderId, payNow } = usePayNow();
  const list = purchases ?? [];
  // El catálogo solo hace falta para titular Sueltos en un paquete pendiente.
  const { catalog } = usePackCatalog({ enabled: list.some((purchase) => purchase.type === 'PACK') });

  return (
    <PendingPurchasesNotice
      purchases={list}
      variant={variant}
      looseName={catalog.dayPack?.nombre ?? null}
      payingOrderId={payingOrderId}
      onPayNow={payNow}
    />
  );
}
