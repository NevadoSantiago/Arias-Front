import { useCallback, useMemo } from 'react';
import { useAuthStore } from '@/features/auth/store/authStore';
import { useCartStore } from '../store/cartStore';
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
 * de día no lo mueve — cada `fecha` tiene su propia lista, y volver a un día
 * muestra lo que se armó ahí (pedido del usuario, 2026-09-26, tarea F12).
 *
 * Las líneas viven en `useCartStore` (sessionStorage, por usuario) y no en el
 * estado de la página, así que navegar a otra pantalla y volver no las pierde
 * (F24).
 */
export function useCart(fecha: string) {
  const ownerId = useCartStore((s) => s.ownerId);
  const stored = useCartStore((s) => s.byDate[fecha]);
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const addLine = useCartStore((s) => s.addLine);
  const removeLine = useCartStore((s) => s.removeLine);
  const clearDay = useCartStore((s) => s.clearDay);

  // Un carrito de otro usuario nunca se muestra, aunque el store aún no se haya limpiado.
  const lines = useMemo(
    () => (ownerId !== null && userId !== null && ownerId !== userId ? [] : (stored ?? [])),
    [ownerId, userId, stored],
  );

  const addItem = useCallback(
    (input: AddCartLineInput) => {
      const count = useCartStore.getState().byDate[fecha]?.length ?? 0;
      addLine(fecha, {
        localId: `${input.dish.id}-${count}-${Date.now()}`,
        dish: input.dish,
        sideId: input.sideId,
        sideNombre: input.sideNombre,
        notas: input.notas,
      });
    },
    [fecha, addLine],
  );

  const removeItem = useCallback((localId: string) => removeLine(fecha, localId), [fecha, removeLine]);

  const clear = useCallback(() => clearDay(fecha), [fecha, clearDay]);

  const totalCredits = useMemo(
    () => lines.reduce((sum, line) => sum + line.dish.category.creditCost, 0),
    [lines]
  );

  return { lines, addItem, removeItem, clear, totalCredits };
}
