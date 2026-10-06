import { ChevronRight, UtensilsCrossed } from 'lucide-react';

interface Props {
  count: number;
  isToday: boolean;
  dayLabel: string;
  onOpenReview: () => void;
}

/**
 * Barra inferior fija de `B2cOrderPage` (F4, prototipo `Main.dc.html`).
 * Vacía: pista para tocar un plato. Con platos: resumen + "Ver pedido",
 * que abre `OrderReviewSheet`.
 */
export function CartBar({ count, isToday, dayLabel, onOpenReview }: Props) {
  return (
    <div className="flex min-h-[74px] flex-none items-center border-t border-border bg-card px-4 py-3">
      {count === 0 ? (
        <p className="m-0 flex items-center gap-2.5 text-sm text-muted-foreground">
          <UtensilsCrossed className="h-[22px] w-[22px] shrink-0 text-primary-deep" aria-hidden="true" />
          <span>Tocá un plato para armar tu pedido.</span>
        </p>
      ) : (
        <div className="flex w-full items-center justify-between gap-3">
          <span className="text-base font-bold text-foreground">
            {count === 1 ? '1 plato' : `${count} platos`} · {isToday ? 'hoy' : dayLabel}
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
