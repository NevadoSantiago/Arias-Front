import { Minus, Plus, UtensilsCrossed } from 'lucide-react';
import { formatLunches } from '@/features/orders/lunches';
import { SelectedSeal } from './PackCardParts';
import { AccountDiscountRows, SummaryDivider, SummaryHeader, SummaryRow, type CardAccountDiscount } from './SummaryCardParts';
import { packSummaryFrameClasses } from './packCardFrame';

interface Props {
  checked: boolean;
  onSelect: () => void;
  qty: number;
  onQtyChange: (qty: number) => void;
  unitPriceLabel: string;
  /** true solo cuando Sueltos está elegido y qty >= 4 (empuje opcional hacia Semana). */
  showNudge: boolean;
  onPickRecommended: () => void;
  /** Lema de la tarjeta (el del pack DAY en el admin, o el que se deduce de la cantidad). */
  lema: string;
  /** Descuento de la cuenta aplicado a la cantidad elegida; `null`/ausente si no hay. */
  accountDiscount?: CardAccountDiscount | null;
}

/**
 * Tarjeta "Sueltos" del celular con el formato de las tarjetas-resumen. Sigue
 * siendo un `div` con un botón radio adentro: el selector 1..10 (botones) no
 * puede ir dentro de un botón. El precio SIEMPRE viene de `priceCents` del pack.
 */
export function LooseSummaryCard({
  checked,
  onSelect,
  qty,
  onQtyChange,
  unitPriceLabel,
  showNudge,
  onPickRecommended,
  lema,
  accountDiscount,
}: Props) {
  return (
    <div className={packSummaryFrameClasses(checked)}>
      {checked && <SelectedSeal />}
      <button
        type="button"
        role="radio"
        aria-checked={checked}
        aria-label={`Almuerzos sueltos, ${unitPriceLabel} cada uno`}
        onClick={onSelect}
        className="flex w-full flex-col gap-3 border-0 bg-transparent p-0 text-left font-sans text-sm text-foreground"
      >
        <SummaryHeader
          icon={<UtensilsCrossed className="h-6 w-6" />}
          name="Sueltos"
          amount={formatLunches(checked ? qty : 1)}
          lema={lema}
        />
        <SummaryDivider />
        <span className="flex flex-col gap-2.5">
          <SummaryRow label="Precio por almuerzo" value={unitPriceLabel} />
          {accountDiscount && <AccountDiscountRows discount={accountDiscount} />}
        </span>
      </button>

      {checked && (
        <div className="flex w-full items-center justify-between gap-3 border-t border-dashed border-border pt-3">
          <span className="text-[10px] font-semibold uppercase tracking-brand text-muted-foreground">Cantidad</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => qty > 1 && onQtyChange(qty - 1)}
              disabled={qty <= 1}
              aria-label="Un almuerzo menos"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-foreground disabled:opacity-40"
            >
              <Minus className="h-5 w-5" aria-hidden="true" />
            </button>
            <span aria-live="polite" className="min-w-[36px] text-center font-display text-[28px] font-black leading-none text-foreground">
              {qty}
            </span>
            <button
              type="button"
              onClick={() => qty < 10 && onQtyChange(qty + 1)}
              disabled={qty >= 10}
              aria-label="Un almuerzo más"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-deep text-primary-foreground disabled:opacity-40"
            >
              <Plus className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {showNudge && (
        <div className="flex items-center gap-2.5 rounded-lg border border-warning bg-warning/20 px-3.5 py-2.5">
          <span className="flex-1 text-[13px] leading-relaxed text-foreground">
            Con el <strong className="font-bold">Paquete Semana</strong> llevás 5 y cada uno te sale más barato.
          </span>
          <button
            type="button"
            onClick={onPickRecommended}
            className="h-11 shrink-0 rounded-md border border-foreground px-3.5 text-[13.5px] font-bold text-foreground"
          >
            Ver paquete
          </button>
        </div>
      )}
    </div>
  );
}
