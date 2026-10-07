import type { Dish } from '@/features/orders/types';

export interface TourDish {
  dishId: number;
  /** El plato tiene acompañamiento elegible: el tour muestra el paso de guarniciones. */
  hasSide: boolean;
}

/**
 * Plato que resalta el tour. Prefiere el primero con stock que tenga
 * acompañamiento (para poder enseñar ese paso); si ninguno lo tiene, el primero
 * con stock; si no hay ninguno que se pueda pedir, `null` y el tour cierra solo.
 * `dishes` va en el orden en que se ven en pantalla. En días futuros el stock
 * no aplica (`checkStock: false`), igual que en `DishCard`.
 */
export function pickTourDish(dishes: Dish[], { checkStock }: { checkStock: boolean }): TourDish | null {
  const orderable = dishes.filter((d) => !checkStock || d.stockActual > 0);
  const hasSide = (d: Dish) => d.sideType !== null && d.allowedSides.some((s) => s.enabled);
  const picked = orderable.find(hasSide) ?? orderable[0];
  return picked ? { dishId: picked.id, hasSide: hasSide(picked) } : null;
}
