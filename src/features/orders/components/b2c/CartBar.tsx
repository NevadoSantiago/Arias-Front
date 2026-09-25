import { ChevronRight, UtensilsCrossed } from 'lucide-react';
import { formatLunches } from '../../lunches';

interface Props {
  count: number;
  totalLunches: number;
  isToday: boolean;
  dayLabel: string;
  onOpenReview: () => void;
}

/**
 * Barra inferior fija de `B2cOrderPage` (F4, prototipo `Main.dc.html`).
 * Vacía: pista para tocar un plato. Con platos: resumen + "Ver pedido",
 * que abre `OrderReviewSheet`.
 */
export function CartBar({ count, totalLunches, isToday, dayLabel, onOpenReview }: Props) {
  return (
    <div className="flex min-h-[74px] flex-none items-center border-t border-border bg-card px-4 py-3">
      {count === 0 ? (
        <p className="m-0 flex items-center gap-2.5 text-sm text-muted-foreground">
          <UtensilsCrossed className="h-[22px] w-[22px] shrink-0 text-primary-deep" aria-hidden="true" />
          <span>Tocá un plato para armar tu pedido.</span>
        </p>
      ) : (
        <div className="flex w-full items-center justify-between gap-3">
          <span className="flex flex-col gap-0.5">
            <span className="text-xs font-semibold text-muted-foreground">
              {count === 1 ? '1 plato' : `${count} platos`} · {isToday ? 'hoy' : dayLabel}
            </span>
            <span className="text-lg font-bold text-foreground">{`Usa ${formatLunches(totalLunches)}`}</span>
          </span>
          <button
            type="button"
            onClick={onOpenReview}
            className="flex h-[52px] items-center gap-2 rounded-md bg-primary-deep px-5 text-sm font-bold uppercase tracking-brand text-primary-foreground"
          >
            Ver pedido
            <ChevronRight className="h-[18px] w-[18px]" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
