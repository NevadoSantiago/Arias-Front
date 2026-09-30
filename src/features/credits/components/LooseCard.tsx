import { Minus, Plus, UtensilsCrossed } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  checked: boolean;
  onSelect: () => void;
  qty: number;
  onQtyChange: (qty: number) => void;
  unitPriceLabel: string;
  /** true solo cuando Sueltos está elegido y qty >= 4 (empuje opcional hacia Semana). */
  showNudge: boolean;
  onPickRecommended: () => void;
  /**
   * `row` (default, móvil): stepper a la izquierda y precio a la derecha.
   * `stacked` (escritorio, F22c): stepper centrado y el precio debajo, para la tarjeta angosta de la grilla.
   */
  layout?: 'row' | 'stacked';
}

/**
 * Tarjeta "Sueltos" — el pack `DAY` con selector 1..10 (F6, prototipo
 * `Packs.dc.html`). El precio SIEMPRE viene de `priceCents` del pack, nunca
 * hardcodeado acá: el label ya formateado se recibe por props.
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
  const stacked = layout === 'stacked';
  return (
    <div
      className={cn(
        'flex w-full flex-col gap-3 rounded-xl border-2 p-4',
        checked ? 'border-primary-deep bg-background shadow-sm' : 'border-border bg-card',
      )}
    >
      <button
        type="button"
        role="radio"
        aria-checked={checked}
        aria-label={`Almuerzos sueltos, ${unitPriceLabel} cada uno`}
        onClick={onSelect}
        className={cn(
          'flex min-h-11 w-full items-center gap-3 border-0 bg-transparent p-0 text-left font-sans text-foreground',
          // Escritorio (F25): ícono y tilde arriba, el nombre en su propia línea debajo.
          stacked && 'flex-wrap',
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
            checked ? 'bg-primary-deep text-primary-foreground' : 'bg-muted text-primary-deep',
          )}
        >
          <UtensilsCrossed className="h-[26px] w-[26px]" aria-hidden="true" />
        </span>
        <span className={cn('flex min-w-0 flex-1 flex-col gap-1', stacked && 'order-last basis-full')}>
          <span className="font-display text-lg font-bold leading-tight">Sueltos</span>
          <span className="text-[13px] text-muted-foreground">De a uno, cuando quieras</span>
        </span>
        <span
          aria-hidden="true"
          className={cn(
            'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2',
            stacked && 'ml-auto',
            checked ? 'border-0 bg-primary-deep text-primary-foreground' : 'border-muted-foreground text-transparent',
          )}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </span>
      </button>

      <div className={cn('flex items-center gap-3', stacked ? 'flex-col' : 'justify-between')}>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => qty > 1 && onQtyChange(qty - 1)}
            disabled={qty <= 1}
            aria-label="Un almuerzo menos"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-foreground disabled:opacity-40"
          >
            <Minus className="h-5 w-5" aria-hidden="true" />
          </button>
          <span aria-live="polite" className="flex min-w-[48px] flex-col items-center gap-0.5">
            <span className="font-display text-[32px] font-black leading-none">{qty}</span>
            <span className="text-[10px] font-semibold uppercase tracking-brand text-muted-foreground">
              {qty === 1 ? 'almuerzo' : 'almuerzos'}
            </span>
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
        <div
          className={cn(
            'flex flex-col gap-0.5',
            stacked ? 'w-full items-start border-t border-dashed border-border pt-3 text-left' : 'items-end text-right',
          )}
        >
          <span className="text-lg font-bold leading-tight">{unitPriceLabel}</span>
          <span className="text-[13px] text-muted-foreground">cada uno</span>
        </div>
      </div>

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
