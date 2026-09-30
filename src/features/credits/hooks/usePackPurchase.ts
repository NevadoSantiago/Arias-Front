import { useMemo } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { createPurchase, getPacks } from '../services/creditsApi';
import { buildCatalog } from '../purchaseModel';

/** Catálogo de `/packs` ya partido en Sueltos + packs con nombre (F6). */
export function usePackCatalog({ enabled = true }: { enabled?: boolean } = {}) {
  const { data, isLoading, isError } = useQuery({ queryKey: ['creditPacks'], queryFn: getPacks, enabled });
  const catalog = useMemo(() => buildCatalog(data), [data]);
  const isEmpty = !isLoading && !isError && !catalog.dayPack && catalog.namedPacks.length === 0;
  return { catalog, isLoading, isError, isEmpty };
}

/**
 * Compra de un pack (con `quantity` opcional para Sueltos) que redirige al
 * checkout de Mercado Pago. La acreditación real ocurre solo vía webhook del
 * backend cuando el usuario vuelve. Lo comparten la página de paquetes y la
 * compra en el lugar de "Mis almuerzos".
 */
export function usePackPurchase() {
  return useMutation({
    mutationFn: (payload: { packId: number; quantity?: number }) =>
      createPurchase({ type: 'PACK', packId: payload.packId, ...(payload.quantity ? { quantity: payload.quantity } : {}) }),
    onSuccess: (checkout) => {
      window.location.href = checkout.initPoint;
    },
    onError: () => {
      toast.error('No pudimos iniciar la compra. Probá de nuevo en unos minutos.');
    },
  });
}
