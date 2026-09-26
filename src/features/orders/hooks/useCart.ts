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
 *
 * El carrito es independiente por día (`fecha`, la misma fecha que usan
 * `getAvailableDishes`/`placeOrderV2`): agregar un plato en un día y cambiar
 * de día no lo mueve — cada `fecha` tiene su propia lista en memoria (sin
 * `localStorage`), y volver a un día muestra lo que se armó ahí (pedido del
 * usuario, 2026-09-26, tarea F12).
 */
export function useCart(fecha: string) {
  const [byDate, setByDate] = useState<Record<string, CartLine[]>>({});

  const lines = useMemo(() => byDate[fecha] ?? [], [byDate, fecha]);

  const addItem = useCallback(
    (input: AddCartLineInput) => {
      setByDate((prev) => {
        const current = prev[fecha] ?? [];
        return {
          ...prev,
          [fecha]: [
            ...current,
            {
              localId: `${input.dish.id}-${current.length}-${Date.now()}`,
              dish: input.dish,
              sideId: input.sideId,
              sideNombre: input.sideNombre,
              notas: input.notas,
            },
          ],
        };
      });
    },
    [fecha],
  );

  const removeItem = useCallback(
    (localId: string) => {
      setByDate((prev) => ({
        ...prev,
        [fecha]: (prev[fecha] ?? []).filter((line) => line.localId !== localId),
      }));
    },
    [fecha],
  );

  const clear = useCallback(() => {
    setByDate((prev) => ({ ...prev, [fecha]: [] }));
  }, [fecha]);

  const totalCredits = useMemo(
    () => lines.reduce((sum, line) => sum + line.dish.category.creditCost, 0),
    [lines]
  );

  return { lines, addItem, removeItem, clear, totalCredits };
}
