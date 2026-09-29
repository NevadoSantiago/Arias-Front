import { useState } from 'react';
import { LooseCard } from '@/features/credits/components/LooseCard';
import { PackOptionCard } from '@/features/credits/components/PackOptionCard';
import { PackCheckoutSheet } from '@/features/credits/components/PackCheckoutSheet';
import { useWallet } from '@/features/credits/hooks/useWallet';
import { usePackCatalog, usePackPurchase } from '@/features/credits/hooks/usePackPurchase';
import { planPurchase, resolveSelection, type PurchaseSelection } from '@/features/credits/purchaseModel';
import { formatPrice, perLunchPriceCents } from '@/features/credits/packPricing';
import { PacksDesktopLayout } from '@/features/credits/components/PacksDesktopLayout';
import { useIsDesktop } from '@/lib/useMediaQuery';

/**
 * Ruta `/credits/packs` — catálogo de Sueltos + paquetes (F6, prototipo `Packs.dc.html`).
 * En escritorio (F22c, `DesktopPacks.dc.html`) son tres tarjetas y un panel "Tu compra".
 */
export function CreditsPacksPage() {
  const { catalog, isLoading, isError, isEmpty: catalogEmpty } = usePackCatalog();
  const { data: wallet } = useWallet();
  const { dayPack, namedPacks, recommended } = catalog;

  const [selection, setSelection] = useState<PurchaseSelection | null>(null);
  const [qty, setQty] = useState(1);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const purchaseMutation = usePackPurchase();
  const isDesktop = useIsDesktop();

  if (isLoading) {
    return (
      <div className="container max-w-xl py-8">
        <p className="text-sm text-muted-foreground">Cargando paquetes…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="container max-w-xl py-8">
        <p className="text-sm text-destructive">No pudimos cargar los paquetes.</p>
      </div>
    );
  }

  if (catalogEmpty) {
    return (
      <div className="container max-w-xl py-8">
        <p className="text-sm text-muted-foreground">Todavía no hay paquetes a la venta.</p>
      </div>
    );
  }

  /**
   * Selección efectiva: si Sueltos no está disponible (no hay pack DAY
   * habilitado) se usa el pack recomendado en su lugar (ver `resolveSelection`).
   * Cuando se llega hasta acá, `catalogEmpty` ya garantiza que hay `dayPack` o
   * al menos un pack con nombre.
   */
  const effectiveSelection = resolveSelection(selection, catalog, isDesktop ? 'week' : 'loose');
  const plan = planPurchase(effectiveSelection, qty, catalog, wallet ? wallet.available : null);
  const summary = plan?.summary ?? { label: '', totalLabel: '' };
  const checkoutSelection = plan?.checkout ?? {
    isLoose: false,
    icon: 'stack5' as const,
    productName: '',
    amountLabel: '',
    perLunchLabel: '',
    hasDiscount: false,
    discountLabel: '',
    totalLabel: '',
    fromAvailable: wallet ? wallet.available : null,
    toAvailable: null,
  };

  const handlePay = () => {
    if (plan) purchaseMutation.mutate(plan.payload);
  };

  if (isDesktop) {
    return (
      <PacksDesktopLayout
        catalog={catalog}
        selection={effectiveSelection}
        onSelect={setSelection}
        qty={qty}
        onQtyChange={setQty}
        plan={plan}
        onPay={handlePay}
        isPending={purchaseMutation.isPending}
      />
    );
  }

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
          {dayPack && (
            <LooseCard
              checked={effectiveSelection?.kind === 'loose'}
              onSelect={() => setSelection({ kind: 'loose' })}
              qty={qty}
              onQtyChange={setQty}
              unitPriceLabel={formatPrice(dayPack.priceCents)}
              showNudge={effectiveSelection?.kind === 'loose' && qty >= 4 && namedPacks.length > 0}
              onPickRecommended={() => {
                if (recommended) setSelection({ kind: 'pack', packId: recommended.id });
              }}
            />
          )}

          {namedPacks.map((pack, i) => (
            <PackOptionCard
              key={pack.id}
              pack={pack}
              checked={effectiveSelection?.kind === 'pack' && effectiveSelection.packId === pack.id}
              onSelect={() => setSelection({ kind: 'pack', packId: pack.id })}
              recommended={recommended?.id === pack.id}
              stackLayers={i === 0 ? 2 : 5}
              priceLabel={formatPrice(pack.priceCents)}
              perLunchLabel={`${formatPrice(perLunchPriceCents(pack))} por almuerzo`}
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
