import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PackCard } from '@/features/credits/components/PackCard';
import { createPurchase, getPacks } from '@/features/credits/services/creditsApi';
import type { CreditPack } from '@/features/credits/types';

/** Ruta `/credits/packs` — catálogo público de paquetes habilitados. */
export function CreditsPacksPage() {
  const { data: packs, isLoading, isError } = useQuery({
    queryKey: ['creditPacks'],
    queryFn: getPacks,
  });

  const purchaseMutation = useMutation({
    mutationFn: (pack: CreditPack) => createPurchase({ type: 'PACK', packId: pack.id }),
    onSuccess: (checkout) => {
      // Redirige al checkout de Mercado Pago — la acreditación real ocurre
      // solo vía webhook del backend cuando el usuario vuelva.
      window.location.href = checkout.initPoint;
    },
    onError: () => {
      toast.error('No pudimos iniciar la compra. Probá de nuevo en unos minutos.');
    },
  });

  return (
    <div className="container py-8 space-y-6 max-w-2xl">
      <h1 className="font-display text-2xl font-bold text-foreground">Paquetes de almuerzos</h1>

      {isLoading && <p className="text-sm text-muted-foreground">Cargando paquetes…</p>}
      {isError && <p className="text-sm text-destructive">No pudimos cargar los paquetes.</p>}

      {packs && packs.length === 0 && (
        <p className="text-sm text-muted-foreground">No hay paquetes disponibles por ahora.</p>
      )}

      <div className="space-y-4">
        {packs?.map((pack) => (
          <PackCard
            key={pack.id}
            pack={pack}
            onSelect={(selected) => purchaseMutation.mutate(selected)}
            isPending={purchaseMutation.isPending}
          />
        ))}
      </div>
    </div>
  );
}
