import { useState } from 'react';
import { Check, Clock } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetTitle } from '@/components/ui/sheet';
import { useWallet } from '../hooks/useWallet';
import { usePackCatalog, usePackPurchase } from '../hooks/usePackPurchase';
import { useCreditExpiryDays } from '../hooks/useCreditExpiryDays';
import { formatPrice, packTagline, perLunchPriceCents } from '../packPricing';
import { planPurchase, resolveSelection, type PurchaseSelection } from '../purchaseModel';
import { catalogAmounts } from '../howItWorksCopy';
import { HowItWorks } from './HowItWorks';
import { LooseSummaryCard } from './LooseSummaryCard';
import { PackSummaryCard } from './PackSummaryCard';
import { PackCheckoutSheet } from './PackCheckoutSheet';

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Hoja a pantalla completa "Comprar almuerzos" (celular) — se abre desde el botón
 * "Comprar más almuerzos" de Mis almuerzos (F6). Es la vista de compra única en
 * celular: catálogo (Sueltos + paquetes), "¿Cómo funciona?", barra fija
 * "Continuar" y la hoja "Revisá tu compra" anidada con el pago.
 */
export function BuyLunchesSheet({ open, onClose }: Props) {
  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent
        aria-label="Comprar almuerzos"
        // Pantalla completa: pisa el anclaje inferior, el tope de ancho/alto y las esquinas de la hoja base.
        className="inset-0 h-full max-h-none w-full max-w-none rounded-none border-0 p-0"
      >
        <BuyLunchesBody />
      </SheetContent>
    </Sheet>
  );
}

/** Contenido separado para que el catálogo y la billetera solo se pidan con la hoja abierta. */
function BuyLunchesBody() {
  const { catalog, isLoading, isError, isEmpty: catalogEmpty } = usePackCatalog();
  const { data: wallet } = useWallet();
  const { dayPack, namedPacks, recommended } = catalog;

  const [selection, setSelection] = useState<PurchaseSelection | null>(null);
  const [qty, setQty] = useState(1);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const purchaseMutation = usePackPurchase();
  const expiryDays = useCreditExpiryDays();

  const effectiveSelection = resolveSelection(selection, catalog, 'loose');
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

  const ready = !isLoading && !isError && !catalogEmpty;

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-6 pt-5">
        <div className="mb-5 flex flex-col gap-1.5 pr-12">
          <SheetTitle className="text-[27px]">Comprar almuerzos</SheetTitle>
          <SheetDescription className="leading-relaxed">
            Cuantos más llevás, menos pagás cada uno. Cada almuerzo es un plato del menú.
          </SheetDescription>
        </div>

        {isLoading && <p className="m-0 text-sm text-muted-foreground">Cargando paquetes…</p>}
        {isError && <p className="m-0 text-sm text-destructive">No pudimos cargar los paquetes.</p>}
        {!isLoading && !isError && catalogEmpty && (
          <p className="m-0 text-sm text-muted-foreground">Todavía no hay paquetes a la venta.</p>
        )}

        {ready && (
          <>
            <div className="mb-5">
              <HowItWorks packAmounts={catalogAmounts(catalog)} />
            </div>

            <div role="radiogroup" aria-label="Elegí qué comprar" className="flex flex-col gap-3">
              {dayPack && (
                <LooseSummaryCard
                  lema={dayPack.lema ?? packTagline(1)}
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

              {namedPacks.map((pack) => (
                <PackSummaryCard
                  key={pack.id}
                  lema={pack.lema ?? packTagline(pack.creditAmount)}
                  pack={pack}
                  checked={effectiveSelection?.kind === 'pack' && effectiveSelection.packId === pack.id}
                  onSelect={() => setSelection({ kind: 'pack', packId: pack.id })}
                  recommended={recommended?.id === pack.id}
                  priceLabel={formatPrice(pack.priceCents)}
                  perLunchLabel={formatPrice(perLunchPriceCents(pack))}
                />
              ))}
            </div>

            <ul className="m-0 mt-6 flex list-none flex-col gap-2.5 p-0">
              <li className="flex items-center gap-3 text-[13.5px] leading-relaxed text-foreground">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-card text-success">
                  <Check className="h-4 w-4" aria-hidden="true" />
                </span>
                <span>Se suman a tu saldo apenas Mercado Pago confirma el pago.</span>
              </li>
              <li className="flex items-center gap-3 text-[13.5px] leading-relaxed text-foreground">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-card text-primary-deep">
                  <Clock className="h-4 w-4" aria-hidden="true" />
                </span>
                <span>Vencen a los {expiryDays} días de tu última compra. Cada compra renueva el plazo.</span>
              </li>
            </ul>
          </>
        )}
      </div>

      {ready && (
        <SheetFooter className="flex-row items-center justify-between gap-3 px-4 py-3">
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
        </SheetFooter>
      )}

      <PackCheckoutSheet
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        selection={checkoutSelection}
        onPay={handlePay}
        isPending={purchaseMutation.isPending}
      />
    </>
  );
}
