import type { Dish } from '@/features/orders/types';

export interface TourDish {
  dishId: number;
  /** El plato tiene acompañamiento elegible: el tour muestra el paso de guarniciones. */
  hasSide: boolean;
}

/**
 * Plato que resalta el tour. Entre los que tienen stock y acompañamiento elegible
 * (para poder enseñar ese paso) prefiere el de menos opciones habilitadas, así el
 * paso de guarniciones entra en pantalla; en empate gana el primero. Si ninguno
 * tiene acompañamiento, el primero con stock; si no hay ninguno que se pueda
 * pedir, `null` y el tour cierra solo.
 * `dishes` va en el orden en que se ven en pantalla. En días futuros el stock
 * no aplica (`checkStock: false`), igual que en `DishCard`.
 */
export function pickTourDish(dishes: Dish[], { checkStock }: { checkStock: boolean }): TourDish | null {
  const orderable = dishes.filter((d) => !checkStock || d.stockActual > 0);
  const hasSide = (d: Dish) => d.sideType !== null && d.allowedSides.some((s) => s.enabled);
  const enabledSides = (d: Dish) => d.allowedSides.filter((s) => s.enabled).length;
  // Estricto `<`: en empate se queda el primero en pantalla.
  const withSides = orderable.filter(hasSide);
  const picked = withSides.reduce<Dish | undefined>((best, d) => (!best || enabledSides(d) < enabledSides(best) ? d : best), undefined) ?? orderable[0];
  return picked ? { dishId: picked.id, hasSide: hasSide(picked) } : null;
}
