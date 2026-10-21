import { useState } from 'react';
import { Lock } from 'lucide-react';
import { useWallet } from '../hooks/useWallet';
import { usePackCatalog, usePackPurchase } from '../hooks/usePackPurchase';
import { formatPrice, packTagline, perLunchPriceCents } from '../packPricing';
import { planPurchase, resolveSelection, type PurchaseSelection } from '../purchaseModel';
import { PackNudge } from './PackNudge';
import { LooseSummaryCard } from './LooseSummaryCard';
import { PackSummaryCard } from './PackSummaryCard';
import { HowItWorks } from './HowItWorks';
import { catalogAmounts } from '../howItWorksCopy';

const MIN_QTY = 1;
const NUDGE_FROM = 4;

/**
 * Panel "Comprar más almuerzos" de Mis almuerzos en escritorio (F22c, prototipo
 * `DesktopCredits.dc.html`): elegís Sueltos / Semana / Mes y comprás EN EL LUGAR,
 * sin pasar por otra página. Usa el mismo catálogo (`/packs`), el mismo plan de
 * compra (`planPurchase`) y la misma mutación con redirección a Mercado Pago que
 * `BuyLunchesSheet` (celular), así que los resultados de la compra son los mismos.
 */
export function BuyLunchesAside() {
  const { catalog, isLoading, isError, isEmpty } = usePackCatalog();
  const { data: wallet } = useWallet();
  const purchase = usePackPurchase();
  const [selection, setSelection] = useState<PurchaseSelection | null>(null);
  const [qty, setQty] = useState(MIN_QTY);

  const { dayPack, namedPacks, weekPack } = catalog;
  const current = resolveSelection(selection, catalog, 'week');
  const plan = planPurchase(current, qty, catalog, wallet ? wallet.available : null);
  const loose = current?.kind === 'loose';
  const showNudge = loose && qty >= NUDGE_FROM && !!weekPack;

  return (
    <aside
      aria-labelledby="buy-lunches-title"
      data-tour="buy"
      className="sticky top-6 flex flex-col gap-4 rounded-xl border border-border bg-card p-[22px]"
    >
      <div className="flex flex-col gap-1">
        <h2 id="buy-lunches-title" className="m-0 font-display text-2xl font-bold leading-tight text-foreground">
          Comprar más almuerzos
        </h2>
        <p className="m-0 text-[13.5px] leading-snug text-muted-foreground">Cuantos más llevás, menos pagás cada uno.</p>
      </div>

      {isLoading && <p className="m-0 text-sm text-muted-foreground">Cargando paquetes…</p>}
      {isError && <p className="m-0 text-sm text-destructive">No pudimos cargar los paquetes.</p>}
      {isEmpty && <p className="m-0 text-sm text-muted-foreground">Todavía no hay paquetes a la venta.</p>}

      {!isLoading && !isError && !isEmpty && (
        <>
          <HowItWorks packAmounts={catalogAmounts(catalog)} />

          <div role="radiogroup" aria-labelledby="buy-lunches-title" className="flex flex-col gap-3">
            {dayPack && (
              <LooseSummaryCard
                checked={loose}
                onSelect={() => setSelection({ kind: 'loose' })}
                qty={qty}
                onQtyChange={setQty}
                unitPriceLabel={formatPrice(dayPack.priceCents)}
                showNudge={false}
                onPickRecommended={() => {}}
                lema={dayPack.lema ?? packTagline(1)}
              />
            )}

            {namedPacks.map((pack) => (
              <PackSummaryCard
                key={pack.id}
                pack={pack}
                checked={current?.kind === 'pack' && current.packId === pack.id}
                onSelect={() => setSelection({ kind: 'pack', packId: pack.id })}
                recommended={catalog.recommended?.id === pack.id}
                priceLabel={formatPrice(pack.priceCents)}
                perLunchLabel={formatPrice(perLunchPriceCents(pack))}
                lema={pack.lema ?? packTagline(pack.creditAmount)}
              />
            ))}
          </div>

          {showNudge && weekPack && (
            <PackNudge pack={weekPack} actionLabel="Elegir paquete" onPick={() => setSelection({ kind: 'pack', packId: weekPack.id })} />
          )}

          {plan && (
            <div data-testid="buy-summary" className="flex flex-col gap-1.5 border-t border-dashed border-border pt-3.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-bold text-foreground">{plan.summary.label}</span>
                <span className="text-lg font-bold text-foreground">{plan.summary.totalLabel}</span>
              </div>
              {plan.checkout.fromAvailable !== null && plan.checkout.toAvailable !== null && (
                <span className="text-[12.5px] leading-snug text-muted-foreground">
                  Tu saldo pasa de {plan.checkout.fromAvailable} a{' '}
                  <strong className="font-bold text-foreground">{plan.checkout.toAvailable}</strong> almuerzos.
                </span>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <button
              type="button"
              disabled={!plan || purchase.isPending}
              aria-label={plan ? `Comprar ${plan.summary.label} por ${plan.summary.totalLabel} con Mercado Pago` : 'Comprar'}
              onClick={() => plan && purchase.mutate(plan.payload)}
              className="flex h-[54px] items-center justify-center gap-2 rounded-md bg-primary-deep text-sm font-bold uppercase tracking-brand text-primary-foreground disabled:opacity-60"
            >
              <Lock className="h-[18px] w-[18px]" aria-hidden="true" />
              {purchase.isPending ? 'Redirigiendo…' : 'Comprar'}
            </button>
            <span className="text-center text-[12.5px] leading-snug text-muted-foreground">
              Pagás en Mercado Pago y después volvés acá.
            </span>
          </div>
        </>
      )}
    </aside>
  );
}
