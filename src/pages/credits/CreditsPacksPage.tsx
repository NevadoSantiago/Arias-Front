import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { LooseCard } from '@/features/credits/components/LooseCard';
import { PackOptionCard } from '@/features/credits/components/PackOptionCard';
import { PackCheckoutSheet } from '@/features/credits/components/PackCheckoutSheet';
import type { PackCheckoutSelection } from '@/features/credits/components/PackCheckoutSheet';
import { createPurchase, getPacks, getWallet } from '@/features/credits/services/creditsApi';
import type { CreditPack } from '@/features/credits/types';
import { formatLunches } from '@/features/orders/lunches';

const DAY_CODE = 'DAY';

function formatPrice(priceCents: number): string {
  return (priceCents / 100).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
}

/**
 * Elige el pack "Recomendado" entre los packs con nombre (no Sueltos):
 * el que tiene el mayor `discountPercent` — el mejor valor real para el
 * cliente, no una posición fija en la lista. Ante empate, gana el de menor
 * `ordenDisplay`. Documentado acá porque el documento de la feature (F6)
 * deja la regla a elección de quien implementa.
 */
function pickRecommended(packs: CreditPack[]): CreditPack | null {
  if (packs.length === 0) return null;
  return packs.reduce((best, p) => {
    if (p.discountPercent > best.discountPercent) return p;
    if (p.discountPercent === best.discountPercent && p.ordenDisplay < best.ordenDisplay) return p;
    return best;
  }, packs[0]);
}

type Selection = { kind: 'loose' } | { kind: 'pack'; packId: number };

/** Ruta `/credits/packs` — catálogo de Sueltos + paquetes (F6, prototipo `Packs.dc.html`). */
export function CreditsPacksPage() {
  const { data: allPacks, isLoading, isError } = useQuery({ queryKey: ['creditPacks'], queryFn: getPacks });
  const { data: wallet } = useQuery({ queryKey: ['creditsWallet'], queryFn: getWallet });

  const dayPack = useMemo(() => allPacks?.find((p) => p.code === DAY_CODE && p.enabled) ?? null, [allPacks]);
  const namedPacks = useMemo(
    () =>
      (allPacks ?? [])
        .filter((p) => p.code !== DAY_CODE && p.enabled)
        .sort((a, b) => a.ordenDisplay - b.ordenDisplay),
    [allPacks],
  );
  const recommended = useMemo(() => pickRecommended(namedPacks), [namedPacks]);

  const [selection, setSelection] = useState<Selection>({ kind: 'loose' });
  const [qty, setQty] = useState(1);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const purchaseMutation = useMutation({
    mutationFn: (payload: { packId: number; quantity?: number }) =>
      createPurchase({ type: 'PACK', packId: payload.packId, ...(payload.quantity ? { quantity: payload.quantity } : {}) }),
    onSuccess: (checkout) => {
      // Redirige al checkout de Mercado Pago — la acreditación real ocurre
      // solo vía webhook del backend cuando el usuario vuelva.
      window.location.href = checkout.initPoint;
    },
    onError: () => {
      toast.error('No pudimos iniciar la compra. Probá de nuevo en unos minutos.');
    },
  });

  if (isLoading) {
    return (
      <div className="container max-w-xl py-8">
        <p className="text-sm text-muted-foreground">Cargando paquetes…</p>
      </div>
    );
  }

  if (isError || !dayPack) {
    return (
      <div className="container max-w-xl py-8">
        <p className="text-sm text-destructive">No pudimos cargar los paquetes.</p>
      </div>
    );
  }

  const selectedPack = selection.kind === 'pack' ? namedPacks.find((p) => p.id === selection.packId) ?? null : null;
  const looseTotalCents = dayPack.priceCents * qty;

  const summary =
    selection.kind === 'loose'
      ? { label: `Sueltos · ${formatLunches(qty)}`, totalLabel: formatPrice(looseTotalCents) }
      : selectedPack
        ? { label: `${selectedPack.nombre} · ${formatLunches(selectedPack.creditAmount)}`, totalLabel: formatPrice(selectedPack.priceCents) }
        : { label: '', totalLabel: '' };

  const checkoutSelection: PackCheckoutSelection =
    selection.kind === 'loose'
      ? {
          isLoose: true,
          icon: 'plate',
          productName: 'Almuerzos sueltos',
          amountLabel: formatLunches(qty),
          perLunchLabel: formatPrice(dayPack.priceCents),
          hasDiscount: false,
          discountLabel: '',
          totalLabel: formatPrice(looseTotalCents),
          fromAvailable: wallet ? wallet.available : null,
          toAvailable: wallet ? wallet.available + qty : null,
        }
      : {
          isLoose: false,
          icon: selectedPack && namedPacks[0]?.id === selectedPack.id ? 'stack2' : 'stack5',
          productName: selectedPack?.nombre ?? '',
          amountLabel: selectedPack ? formatLunches(selectedPack.creditAmount) : '',
          perLunchLabel: selectedPack ? formatPrice(Math.round(selectedPack.priceCents / selectedPack.creditAmount)) : '',
          hasDiscount: !!selectedPack && selectedPack.discountPercent > 0,
          discountLabel: selectedPack ? `−${selectedPack.discountPercent}%` : '',
          totalLabel: selectedPack ? formatPrice(selectedPack.priceCents) : '',
          fromAvailable: wallet ? wallet.available : null,
          toAvailable: wallet && selectedPack ? wallet.available + selectedPack.creditAmount : null,
        };

  const handlePay = () => {
    if (selection.kind === 'loose') {
      purchaseMutation.mutate({ packId: dayPack.id, quantity: qty });
    } else if (selectedPack) {
      purchaseMutation.mutate({ packId: selectedPack.id });
    }
  };

  return (
    <div className="flex flex-col">
      <div className="container max-w-xl flex-1 py-6 lg:py-10">
        <div className="mb-5 flex flex-col gap-1.5">
          <h1 className="font-display text-[27px] font-bold leading-tight text-foreground lg:text-3xl">
            Comprar almuerzos
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Cuantos más llevás, menos pagás cada uno. Cada almuerzo es un plato del menú.
          </p>
        </div>

        <div role="radiogroup" aria-label="Elegí qué comprar" className="flex flex-col gap-3">
          <LooseCard
            checked={selection.kind === 'loose'}
            onSelect={() => setSelection({ kind: 'loose' })}
            qty={qty}
            onQtyChange={setQty}
            unitPriceLabel={formatPrice(dayPack.priceCents)}
            showNudge={selection.kind === 'loose' && qty >= 4 && namedPacks.length > 0}
            onPickRecommended={() => {
              if (recommended) setSelection({ kind: 'pack', packId: recommended.id });
            }}
          />

          {namedPacks.map((pack, i) => (
            <PackOptionCard
              key={pack.id}
              pack={pack}
              checked={selection.kind === 'pack' && selection.packId === pack.id}
              onSelect={() => setSelection({ kind: 'pack', packId: pack.id })}
              recommended={recommended?.id === pack.id}
              stackLayers={i === 0 ? 2 : 5}
              priceLabel={formatPrice(pack.priceCents)}
              perLunchLabel={`${formatPrice(Math.round(pack.priceCents / pack.creditAmount))} por almuerzo`}
            />
          ))}
        </div>

        <ul className="m-0 mt-6 flex list-none flex-col gap-2.5 p-0">
          <li className="flex items-center gap-3 text-[13.5px] leading-relaxed text-foreground">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-card text-success">
              ✓
            </span>
            <span>Se suman a tu saldo apenas Mercado Pago confirma el pago.</span>
          </li>
          <li className="flex items-center gap-3 text-[13.5px] leading-relaxed text-foreground">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-card text-primary-deep">
              ⏱
            </span>
            <span>Vencen a los 90 días de tu última compra. Cada compra renueva el plazo.</span>
          </li>
        </ul>
      </div>

      <div className="sticky bottom-0 z-20 flex items-center justify-between gap-3 border-t border-border bg-card px-4 py-3">
        <span className="flex min-w-0 flex-col gap-1">
          <span className="text-xs font-semibold text-muted-foreground">{summary.label}</span>
          <span className="text-lg font-bold text-foreground">{summary.totalLabel}</span>
        </span>
        <button
          type="button"
          onClick={() => setCheckoutOpen(true)}
          className="flex h-[52px] shrink-0 items-center gap-2 rounded-md bg-primary-deep px-5 text-sm font-bold uppercase tracking-brand text-primary-foreground"
        >
          Continuar
        </button>
      </div>

      <PackCheckoutSheet
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        selection={checkoutSelection}
        onPay={handlePay}
        isPending={purchaseMutation.isPending}
      />
    </div>
  );
}
