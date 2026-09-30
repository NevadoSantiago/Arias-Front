import { CalendarDays, Lock, UtensilsCrossed, Banknote } from 'lucide-react';
import type { PackCheckoutSelection } from './PackCheckoutSheet';

interface Props {
  selection: PackCheckoutSelection;
  /** Fecha en que vencerían los almuerzos con esta compra, ya formateada; null si no se muestra. */
  expiryLabel: string | null;
  onPay: () => void;
  isPending: boolean;
}

/**
 * Panel fijo "Tu compra" de la página de paquetes en escritorio (F22c, prototipo
 * `DesktopPacks.dc.html`): lo mismo que la hoja "Revisá tu compra" del móvil
 * (`PackCheckoutSheet`), pero siempre a la vista y con el pago directo. Los
 * importes llegan ya calculados en `selection` (`planPurchase`); acá solo se muestran.
 */
export function PackPurchasePanel({ selection, expiryLabel, onPay, isPending }: Props) {
  const Icon = selection.icon === 'plate' ? UtensilsCrossed : Banknote;
  const hasBalance = selection.fromAvailable !== null && selection.toAvailable !== null;

  return (
    <aside
      aria-labelledby="pack-purchase-title"
      className="sticky top-6 mt-[46px] flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-md"
    >
      <div className="flex flex-col gap-4 px-[22px] py-5">
        <h2 id="pack-purchase-title" className="m-0 font-display text-2xl font-bold leading-tight text-foreground">
          Tu compra
        </h2>

        <div className="flex flex-col gap-3 rounded-xl border border-border bg-background p-3.5">
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-deep text-primary-foreground">
              <Icon className="h-6 w-6" aria-hidden="true" />
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
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

        {hasBalance && (
          <div className="flex items-center gap-3 rounded-xl bg-muted px-3.5 py-3">
            <span aria-hidden="true" className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-foreground text-primary-foreground">
              <UtensilsCrossed className="h-[22px] w-[22px]" aria-hidden="true" />
            </span>
            <span className="flex flex-col gap-0.5 text-[13.5px] leading-relaxed text-foreground">
              <span>
                Tu saldo pasa de <strong className="font-bold">{selection.fromAvailable}</strong> a{' '}
                <strong className="font-bold">{selection.toAvailable}</strong> almuerzos.
              </span>
              {expiryLabel && (
                <span className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  Todos tus disponibles vencerán el {expiryLabel}.
                </span>
              )}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 border-t border-border bg-background px-[22px] py-4">
        <button
          type="button"
          onClick={onPay}
          disabled={isPending}
          className="flex h-[54px] w-full items-center justify-center gap-2 rounded-md bg-primary-deep text-sm font-bold uppercase tracking-brand text-primary-foreground disabled:opacity-60"
        >
          <Lock className="h-[18px] w-[18px]" aria-hidden="true" />
          {isPending ? 'Redirigiendo…' : 'Pagar con Mercado Pago'}
        </button>
        <span className="text-center text-[12.5px] leading-snug text-muted-foreground">
          Vas a completar el pago en Mercado Pago y después volvés acá.
        </span>
      </div>
    </aside>
  );
}
