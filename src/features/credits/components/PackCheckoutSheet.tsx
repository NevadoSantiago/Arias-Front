import { Banknote, UtensilsCrossed } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

export interface PackCheckoutSelection {
  isLoose: boolean;
  icon: 'plate' | 'stack2' | 'stack5';
  productName: string;
  amountLabel: string;
  perLunchLabel: string;
  hasDiscount: boolean;
  discountLabel: string;
  totalLabel: string;
  /** Saldo disponible antes/después de esta compra — solo informativo; null hasta que se conoce. */
  fromAvailable: number | null;
  toAvailable: number | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  selection: PackCheckoutSelection;
  onPay: () => void;
  isPending: boolean;
}

function ProductIcon({ icon }: { icon: PackCheckoutSelection['icon'] }) {
  if (icon === 'plate') return <UtensilsCrossed className="h-6 w-6" aria-hidden="true" />;
  return <Banknote className="h-6 w-6" aria-hidden="true" />;
}

/**
 * Hoja "Revisá tu compra" (F6, prototipo `Packs.dc.html`) — se abre desde
 * "Continuar" en `CreditsPacksPage`. El precio y el descuento vienen
 * calculados por el padre a partir de `priceCents`/`discountPercent` del
 * pack; acá solo se presentan.
 */
export function PackCheckoutSheet({ open, onClose, selection, onPay, isPending }: Props) {
  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent aria-label="Revisá tu compra" className="p-0">
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
          <SheetTitle>Revisá tu compra</SheetTitle>
          <SheetDescription className="sr-only">
            Confirmá el producto, el precio y el nuevo saldo antes de pagar con Mercado Pago.
          </SheetDescription>

          <div className="flex flex-col gap-3 rounded-xl border border-border bg-background p-3.5">
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-deep text-primary-foreground"
              >
                <ProductIcon icon={selection.icon} />
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="font-display text-[17px] font-bold leading-tight">{selection.productName}</span>
                <span className="text-[13px] text-muted-foreground">{selection.amountLabel}</span>
              </span>
            </div>
            <div aria-hidden="true" className="border-t border-dashed border-border" />
            <dl className="m-0 flex flex-col gap-2.5">
              <div className="flex justify-between gap-3 text-sm">
                <dt className="text-muted-foreground">Precio por almuerzo</dt>
                <dd className="m-0 font-semibold">{selection.perLunchLabel}</dd>
              </div>
              {selection.hasDiscount && (
                <div className="flex justify-between gap-3 text-sm">
                  <dt className="text-muted-foreground">Descuento</dt>
                  <dd className="m-0 font-bold text-success">{selection.discountLabel}</dd>
                </div>
              )}
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-[15px] font-bold">Total</dt>
                <dd className="m-0 text-[19px] font-bold">{selection.totalLabel}</dd>
              </div>
            </dl>
          </div>

          {selection.fromAvailable !== null && selection.toAvailable !== null && (
            <div className="flex items-center gap-3 rounded-xl bg-muted px-3.5 py-3">
              <span
                aria-hidden="true"
                className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-foreground text-primary-foreground"
              >
                <UtensilsCrossed className="h-[22px] w-[22px]" aria-hidden="true" />
              </span>
              <span className={cn('text-[13.5px] leading-relaxed text-foreground')}>
                Tu saldo pasa de <strong className="font-bold">{selection.fromAvailable}</strong> a{' '}
                <strong className="font-bold">{selection.toAvailable}</strong> almuerzos.
              </span>
            </div>
          )}
        </div>
        <SheetFooter>
          <button
            type="button"
            onClick={onPay}
            disabled={isPending}
            className="flex h-[52px] w-full items-center justify-center gap-2.5 rounded-md bg-primary-deep text-sm font-bold uppercase tracking-[0.08em] text-primary-foreground disabled:opacity-60"
          >
            {isPending ? 'Redirigiendo…' : 'Pagar con Mercado Pago'}
          </button>
          <span className="text-center text-[12.5px] leading-relaxed text-muted-foreground">
            Vas a completar el pago en Mercado Pago y después volvés acá.
          </span>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
