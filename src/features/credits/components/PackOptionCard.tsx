import { cn } from '@/lib/utils';
import { formatLunches } from '@/features/orders/lunches';
import type { CreditPack } from '../types';

function StackIcon({ layers }: { layers: 2 | 5 }) {
  if (layers === 2) {
    return (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <ellipse cx="12" cy="9.5" rx="8" ry="2.4" />
        <path d="M4 9.5v2.6a8 2.4 0 0 0 16 0V9.5" />
        <path d="M4 12.1v2.6a8 2.4 0 0 0 16 0v-2.6" />
      </svg>
    );
  }
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <ellipse cx="12" cy="5" rx="8" ry="2.4" />
      <path d="M4 5v2.6a8 2.4 0 0 0 16 0V5" />
      <path d="M4 7.6v2.6a8 2.4 0 0 0 16 0V7.6" />
      <path d="M4 10.2v2.6a8 2.4 0 0 0 16 0v-2.6" />
      <path d="M4 12.8v2.6a8 2.4 0 0 0 16 0v-2.6" />
      <path d="M4 15.4V18a8 2.4 0 0 0 16 0v-2.6" />
    </svg>
  );
}

interface Props {
  pack: CreditPack;
  checked: boolean;
  onSelect: () => void;
  recommended: boolean;
  /** "stack of 2" para el primer pack no-Sueltos, "stack of 5" para el resto — ver CreditsPacksPage. */
  stackLayers: 2 | 5;
  priceLabel: string;
  perLunchLabel: string;
}

/**
 * Tarjeta radio de un pack con nombre (Semana, Mes, ...) — F6, prototipo
 * `Packs.dc.html`. El precio y el descuento SIEMPRE vienen de `priceCents` /
 * `discountPercent` del pack, nunca hardcodeados.
 */
export function PackOptionCard({ pack, checked, onSelect, recommended, stackLayers, priceLabel, perLunchLabel }: Props) {
  const ariaLabel = `${pack.nombre}, ${formatLunches(pack.creditAmount)}, ${priceLabel}${
    pack.discountPercent > 0 ? `, ahorrás ${pack.discountPercent}%` : ''
  }`;

  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={onSelect}
      className={cn(
        'flex w-full flex-col gap-3 rounded-xl border-2 p-4 text-left font-sans text-foreground',
        checked ? 'border-primary-deep bg-background shadow-sm' : 'border-border bg-card',
      )}
    >
      <span className="flex w-full items-center gap-3">
        <span
          aria-hidden="true"
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
            checked ? 'bg-primary-deep text-primary-foreground' : 'bg-muted text-primary-deep',
          )}
        >
          <StackIcon layers={stackLayers} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col items-start gap-1.5 text-left">
          <span className="font-display text-lg font-bold leading-tight">{pack.nombre}</span>
          {recommended && (
            <span className="inline-flex h-[22px] items-center rounded-full bg-foreground px-2.5 text-[10px] font-bold uppercase tracking-brand text-primary-foreground">
              Recomendado
            </span>
          )}
        </span>
        <span
          aria-hidden="true"
          className={cn(
            'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2',
            checked ? 'border-0 bg-primary-deep text-primary-foreground' : 'border-muted-foreground text-transparent',
          )}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </span>
      </span>

      <span className="flex w-full items-end justify-between gap-3">
        <span className="flex flex-col items-start gap-1">
          <span className="font-display text-[35px] font-black leading-none">{pack.creditAmount}</span>
          <span className="text-[10px] font-semibold uppercase tracking-brand text-muted-foreground">almuerzos</span>
        </span>
        <span className="flex flex-col items-end gap-1 text-right">
          <span className="text-lg font-bold leading-tight">{priceLabel}</span>
          <span className="text-[13px] text-muted-foreground">{perLunchLabel}</span>
        </span>
      </span>

      {pack.discountPercent > 0 && (
        <>
          <span aria-hidden="true" className="w-full border-t border-dashed border-border" />
          <span className="flex items-center gap-2 text-[13.5px] font-bold text-success">Ahorrás {pack.discountPercent}%</span>
        </>
      )}
    </button>
  );
}
