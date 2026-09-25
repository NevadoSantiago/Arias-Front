import { useState } from 'react';
import { UtensilsCrossed } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatLunches } from '../../lunches';
import type { Dish } from '../../types';

interface Props {
  dish: Dish;
  onSelect: (dish: Dish) => void;
  /**
   * Oculta indicadores de stock (para días futuros donde no aplica) — misma
   * semántica que `DishCard.hideStock`, ver `B2cOrderPage` (`hideStock={!isToday}`).
   */
  hideStock?: boolean;
}

/**
 * Fila de plato B2C (F8, prototipo aprobado `Main.dc.html` — lista de
 * platos). Reemplaza a `DishCard` SOLO en `B2cOrderPage`: `DishCard` sigue
 * igual para `CompanyOrderPage` (B2B) y para la vista de solo lectura del
 * resumen (restricción de la feature). El badge de tier (Premium/Básico) NO
 * se muestra, igual que en `DishCard` — es info interna de facturación.
 */
export function DishListItem({ dish, onSelect, hideStock = false }: Props) {
  const [imgFailed, setImgFailed] = useState(false);
  const hasStock = hideStock || dish.stockActual > 0;
  const isLowStock = !hideStock && dish.stockActual > 0 && dish.stockActual <= 3;
  const showFallback = !dish.fotoUrl || imgFailed;
  const isClickable = hasStock;
  const costText = `Usa ${formatLunches(dish.category.creditCost)}`;

  return (
    <button
      type="button"
      data-testid="dish-list-item"
      onClick={() => isClickable && onSelect(dish)}
      disabled={!isClickable}
      aria-disabled={!isClickable}
      className={cn(
        'group flex w-full items-stretch gap-3 rounded-lg border-2 bg-card p-2.5 text-left',
        'transition-colors duration-150',
        isClickable
          ? 'border-border hover:border-primary cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
          : 'border-border opacity-50 cursor-not-allowed grayscale',
      )}
    >
      {/* Foto */}
      <span className="relative h-[104px] w-24 shrink-0 overflow-hidden rounded-md bg-muted">
        {showFallback ? (
          <span className="flex h-full w-full items-center justify-center text-muted-foreground">
            <UtensilsCrossed className="h-10 w-10 opacity-40" aria-hidden="true" />
          </span>
        ) : (
          <img
            src={dish.fotoUrl!}
            alt=""
            className={cn(
              'h-full w-full object-cover transition-transform duration-300',
              '[filter:contrast(1.05)_saturate(1.1)_brightness(1.02)]',
              isClickable && 'group-hover:scale-105',
            )}
            loading="lazy"
            onError={() => setImgFailed(true)}
          />
        )}

        {!hasStock && (
          <span className="absolute left-1.5 top-1.5 rounded bg-foreground px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-brand text-background">
            Sin stock
          </span>
        )}

        {isLowStock && hasStock && (
          <span className="absolute left-1.5 top-1.5">
            <Badge
              variant="default"
              className="uppercase tracking-brand text-[9.5px] bg-warning text-warning-foreground hover:bg-warning"
            >
              Últimos {dish.stockActual}
            </Badge>
          </span>
        )}
      </span>

      {/* Body */}
      <span className="flex min-w-0 flex-1 flex-col justify-center gap-1 py-0.5">
        <span className="text-[10px] font-semibold uppercase tracking-brand text-muted-foreground">
          {dish.menuSection.nombre}
        </span>
        <span className="font-display text-[17px] font-bold leading-tight text-foreground line-clamp-1">
          {dish.nombre}
        </span>
        <span className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          {dish.descripcion}
        </span>
        <span className="mt-auto inline-flex items-center gap-1.5 pt-1 text-xs font-bold text-primary-deep">
          <UtensilsCrossed className="h-3.5 w-3.5" aria-hidden="true" />
          {costText}
        </span>
      </span>
    </button>
  );
}
