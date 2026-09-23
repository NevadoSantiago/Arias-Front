import { useCallback, useMemo, useState } from 'react';
import type { Dish } from '../types';

export interface CartLine {
  /** Id local (no lo conoce el backend) — solo sirve para manejar la lista en el cliente. */
  localId: string;
  dish: Dish;
  sideId: number | null;
  sideNombre: string | null;
  notas: string | null;
}

export interface AddCartLineInput {
  dish: Dish;
  sideId: number | null;
  sideNombre: string | null;
  notas: string | null;
}

/**
 * Estado del carrito multi-ítem (contraparte de UI de la spec backend
 * `order-placement`, "Pedidos con múltiples ítems"). El costo de cada línea
 * sale de `dish.category.creditCost` tal como lo reporta el backend — nunca
 * se recalcula ni se hardcodea acá (proposal, "Vocabulario").
 */
export function useCart() {
  const [lines, setLines] = useState<CartLine[]>([]);

  const addItem = useCallback((input: AddCartLineInput) => {
    setLines((prev) => [
      ...prev,
      {
        localId: `${input.dish.id}-${prev.length}-${Date.now()}`,
        dish: input.dish,
        sideId: input.sideId,
        sideNombre: input.sideNombre,
        notas: input.notas,
      },
    ]);
  }, []);

  const removeItem = useCallback((localId: string) => {
    setLines((prev) => prev.filter((line) => line.localId !== localId));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const totalCredits = useMemo(
    () => lines.reduce((sum, line) => sum + line.dish.category.creditCost, 0),
    [lines]
  );

  return { lines, addItem, removeItem, clear, totalCredits };
}
