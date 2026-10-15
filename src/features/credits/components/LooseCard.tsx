import { Minus, Plus } from 'lucide-react';
import { packTagline } from '../packPricing';
import {
  CountBlock,
  PriceBlock,
  SelectedSeal,
  TaglineRow,
} from './PackCardParts';
import { packCardFrameClasses, type PackCardLayout } from './packCardFrame';

interface Props {
  checked: boolean;
  onSelect: () => void;
  qty: number;
  onQtyChange: (qty: number) => void;
  unitPriceLabel: string;
  /** true solo cuando Sueltos está elegido y qty >= 4 (empuje opcional hacia Semana). */
  showNudge: boolean;
  onPickRecommended: () => void;
  /** `row` (default, móvil) o `stacked` (escritorio): ver `CountBlock`. */
  layout?: PackCardLayout;
}

/**
 * Tarjeta "Sueltos" — el pack `DAY`, con la misma cara que las de los paquetes.
 * El selector 1..10 aparece solo cuando la tarjeta está elegida. El precio
 * SIEMPRE viene de `priceCents` del pack: el label ya formateado llega por props.
 */
export function LooseCard({
  checked,
  onSelect,
  qty,
  onQtyChange,
  unitPriceLabel,
  showNudge,
  onPickRecommended,
  layout = 'row',
}: Props) {
  return (
    <div className={`${packCardFrameClasses(checked)} gap-3 px-4 py-5`}>
      {checked && <SelectedSeal />}
      <button
        type="button"
        role="radio"
        aria-checked={checked}
        aria-label={`Almuerzos sueltos, ${unitPriceLabel} cada uno`}
        onClick={onSelect}
        className="flex w-full flex-col items-center gap-3 border-0 bg-transparent p-0 text-left font-sans text-foreground"
      >
        <CountBlock count={1} word="almuerzo" layout={layout} />
        <TaglineRow>{packTagline(1)}</TaglineRow>
        <PriceBlock price={unitPriceLabel} />
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
