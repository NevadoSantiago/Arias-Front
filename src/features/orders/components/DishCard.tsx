import { useState } from 'react';
import { UtensilsCrossed } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Dish } from '../types';
// El badge de tier (Premium/Básico) NO se muestra — es info interna de facturación,
// no es relevante para el empleado al pedir.

interface Props {
  dish: Dish;
  onSelect: (dish: Dish) => void;
  /**
   * Solo lectura: el usuario ya hizo su pedido del día (cerrado).
   * Las cards muestran el menú pero no son interactivas.
   */
  readonly?: boolean;
  /** Oculta indicadores de stock (para días futuros donde no aplica). */
  hideStock?: boolean;
}

export function DishCard({ dish, onSelect, readonly = false, hideStock = false }: Props) {
  const [imgFailed, setImgFailed] = useState(false);
  const hasStock = hideStock || dish.stockActual > 0;
  const isLowStock = !hideStock && dish.stockActual > 0 && dish.stockActual <= 3;
  const showFallback = !dish.fotoUrl || imgFailed;

  const isClickable = hasStock && !readonly;

  return (
    <button
      type="button"
      onClick={() => isClickable && onSelect(dish)}
      disabled={!isClickable}
      aria-disabled={!isClickable}
      className={cn(
        'group text-left bg-card border border-border rounded-lg overflow-hidden',
        'transition-all duration-200',
        isClickable
          ? 'hover:border-primary hover:shadow-md cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
          : !hasStock
            ? 'opacity-50 cursor-not-allowed grayscale'
            : 'opacity-75 cursor-default'
      )}
    >
      {/* Foto */}
      <div className="aspect-[4/3] bg-muted relative overflow-hidden">
        {showFallback ? (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <UtensilsCrossed className="w-12 h-12 opacity-40" />
          </div>
        ) : (
          <img
            src={dish.fotoUrl!}
            alt={dish.nombre}
            className={cn(
              'w-full h-full object-cover transition-transform duration-300',
              '[filter:contrast(1.05)_saturate(1.1)_brightness(1.02)]',
              isClickable && 'group-hover:scale-105'
            )}
            loading="lazy"
            onError={() => setImgFailed(true)}
          />
        )}

        {/* Overlay de "Sin stock" — solo si no hay stock; en readonly puro NO mostramos */}
        {!hasStock && !readonly && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
            <span className="font-sans text-sm uppercase tracking-brand text-foreground font-semibold">
              Sin stock
            </span>
          </div>
        )}

        {/* Stock bajo — no se muestra en readonly porque ya no es accionable */}
        {isLowStock && hasStock && !readonly && (
          <div className="absolute top-3 right-3">
            <Badge variant="default" className="uppercase tracking-brand text-[10px] bg-warning text-warning-foreground hover:bg-warning">
              Últimos {dish.stockActual}
            </Badge>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-3 sm:p-4 space-y-1.5 sm:space-y-2">
        <h3 className="font-sans font-semibold uppercase tracking-brand text-xs sm:text-sm text-foreground leading-snug line-clamp-2">
          {dish.nombre}
        </h3>
        <p className="text-[11px] sm:text-xs text-muted-foreground line-clamp-2 leading-relaxed">
          {dish.descripcion}
        </p>
      </div>
    </button>
  );
}
