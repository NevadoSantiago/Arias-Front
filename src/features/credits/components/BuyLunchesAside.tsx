import { useState } from 'react';
import { Lock, Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatLunches } from '@/features/orders/lunches';
import { useWallet } from '../hooks/useWallet';
import { usePackCatalog, usePackPurchase } from '../hooks/usePackPurchase';
import { formatPrice, perLunchPriceCents } from '../packPricing';
import { planPurchase, resolveSelection, type PurchaseSelection } from '../purchaseModel';
import { PackNudge } from './PackNudge';

const MIN_QTY = 1;
const MAX_QTY = 10;
const NUDGE_FROM = 4;

/** Punto del radio: el mismo control visual para las tres opciones. */
function RadioDot({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2',
        on ? 'border-primary-deep' : 'border-muted-foreground',
      )}
    >
      <span className={cn('h-2.5 w-2.5 rounded-full', on ? 'bg-primary-deep' : 'bg-transparent')} />
    </span>
  );
}

const rowBox = (on: boolean) =>
  cn('rounded-[10px] bg-background', on ? 'border-2 border-primary-deep' : 'border border-border');

/**
 * Panel "Comprar más almuerzos" de Mis almuerzos en escritorio (F22c, prototipo
 * `DesktopCredits.dc.html`): elegís Sueltos / Semana / Mes y comprás EN EL LUGAR,
 * sin pasar por la página de Paquetes. Usa el mismo catálogo (`/packs`), el mismo
 * plan de compra (`planPurchase`) y la misma mutación con redirección a Mercado
 * Pago que `CreditsPacksPage`, así que los resultados de la compra son los mismos.
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
          <div role="radiogroup" aria-labelledby="buy-lunches-title" className="flex flex-col gap-2">
            {dayPack && (
              <div className={cn('flex flex-col', rowBox(loose))}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={loose}
                  aria-label={`Almuerzos sueltos, ${formatPrice(dayPack.priceCents)} cada uno`}
                  onClick={() => setSelection({ kind: 'loose' })}
                  className="flex min-h-[60px] w-full items-center gap-3 border-0 bg-transparent px-3 py-2.5 text-left font-sans text-foreground"
                >
                  <RadioDot on={loose} />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="font-display text-base font-bold">Sueltos</span>
                    <span className="text-[12.5px] text-muted-foreground">De {MIN_QTY} a {MAX_QTY} almuerzos</span>
                  </span>
                  <span className="whitespace-nowrap text-sm font-bold">{formatPrice(dayPack.priceCents)} c/u</span>
                </button>
                {loose && (
                  <div className="flex items-center justify-between gap-3 pb-3 pl-[46px] pr-3">
                    <span id="buy-lunches-qty" className="text-[13px] font-semibold text-muted-foreground">
                      ¿Cuántos?
                    </span>
                    <div role="group" aria-labelledby="buy-lunches-qty" className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setQty((q) => Math.max(MIN_QTY, q - 1))}
                        disabled={qty <= MIN_QTY}
                        aria-label="Un almuerzo menos"
                        className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-foreground disabled:opacity-40"
                      >
                        <Minus className="h-[18px] w-[18px]" aria-hidden="true" />
                      </button>
                      <span aria-live="polite" className="flex min-w-[44px] flex-col items-center gap-0.5">
                        <span className="font-display text-[28px] font-black leading-none">{qty}</span>
                        <span className="text-[9.5px] font-semibold uppercase tracking-brand text-muted-foreground">
                          {qty === 1 ? 'almuerzo' : 'almuerzos'}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setQty((q) => Math.min(MAX_QTY, q + 1))}
                        disabled={qty >= MAX_QTY}
                        aria-label="Un almuerzo más"
                        className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-deep text-primary-foreground disabled:opacity-40"
                      >
                        <Plus className="h-[18px] w-[18px]" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {namedPacks.map((pack) => {
              const on = current?.kind === 'pack' && current.packId === pack.id;
              const sub = `${formatLunches(pack.creditAmount)}${pack.discountPercent > 0 ? ` · ahorrás ${pack.discountPercent}%` : ''}`;
              const price = formatPrice(pack.priceCents);
              return (
                <button
                  key={pack.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  aria-label={`${pack.nombre}, ${sub}, ${price}`}
                  onClick={() => setSelection({ kind: 'pack', packId: pack.id })}
                  className={cn(
                    'flex min-h-16 w-full items-center gap-3 px-3 py-2.5 text-left font-sans text-foreground',
                    rowBox(on),
                  )}
                >
                  <RadioDot on={on} />
                  <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                    <span className="flex items-center gap-2">
                      <span className="font-display text-base font-bold">{pack.nombre}</span>
                      {catalog.recommended?.id === pack.id && (
                        <span className="inline-flex h-5 items-center rounded-full bg-foreground px-[7px] text-[9px] font-bold uppercase tracking-brand text-primary-foreground">
                          Recomendado
                        </span>
                      )}
                    </span>
                    <span className="text-[12.5px] text-muted-foreground">
                      {sub} · {formatPrice(perLunchPriceCents(pack))} c/u
                    </span>
                  </span>
                  <span className="whitespace-nowrap text-sm font-bold">{price}</span>
                </button>
              );
            })}
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
