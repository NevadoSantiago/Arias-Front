import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useCart } from './useCart';
import type { Dish } from '../types';

function makeDish(id: number, creditCost: number): Dish {
  return {
    id,
    nombre: `Plato ${id}`,
    descripcion: '',
    fotoUrl: null,
    category: { id: 1, nombre: 'Básico', parentId: null, creditCost },
    menuSection: { id: 1, nombre: 'Carnes', ordenDisplay: 1 },
    sideType: null,
    allowedSides: [],
    stockActual: 5,
    especial: false,
  };
}

const DAY_A = '2026-06-01';
const DAY_B = '2026-06-02';

describe('useCart', () => {
  it('starts empty with a total of 0', () => {
    const { result } = renderHook(() => useCart(DAY_A));

    expect(result.current.lines).toHaveLength(0);
    expect(result.current.totalCredits).toBe(0);
  });

  it('sums each line credit cost from dish.category.creditCost — never a hardcoded price', () => {
    const { result } = renderHook(() => useCart(DAY_A));

    act(() => {
      result.current.addItem({ dish: makeDish(1, 2), sideId: null, sideNombre: null, notas: null });
    });
    act(() => {
      result.current.addItem({ dish: makeDish(2, 3), sideId: null, sideNombre: null, notas: null });
    });

    expect(result.current.lines).toHaveLength(2);
    expect(result.current.totalCredits).toBe(5);
  });

  it('allows the same dish twice as two independent lines (no quantity field on the wire payload)', () => {
    const { result } = renderHook(() => useCart(DAY_A));
    const dish = makeDish(1, 2);

    act(() => {
      result.current.addItem({ dish, sideId: null, sideNombre: null, notas: null });
      result.current.addItem({ dish, sideId: null, sideNombre: null, notas: null });
    });

    expect(result.current.lines).toHaveLength(2);
    expect(result.current.totalCredits).toBe(4);
  });

  it('recomputes the total after removing a line', () => {
    const { result } = renderHook(() => useCart(DAY_A));

    act(() => {
      result.current.addItem({ dish: makeDish(1, 2), sideId: null, sideNombre: null, notas: null });
      result.current.addItem({ dish: makeDish(2, 3), sideId: null, sideNombre: null, notas: null });
    });
    const toRemove = result.current.lines[0].localId;

    act(() => {
      result.current.removeItem(toRemove);
    });

    expect(result.current.lines).toHaveLength(1);
    expect(result.current.totalCredits).toBe(3);
  });

  it('clears the cart', () => {
    const { result } = renderHook(() => useCart(DAY_A));

    act(() => {
      result.current.addItem({ dish: makeDish(1, 2), sideId: null, sideNombre: null, notas: null });
    });
    act(() => {
      result.current.clear();
    });

    expect(result.current.lines).toHaveLength(0);
    expect(result.current.totalCredits).toBe(0);
  });

  /**
   * F12 (pedido del usuario, 2026-09-26): el carrito es independiente por
   * día — agregar un plato en un día y cambiar de día no lo mueve.
   */
  describe('per-day isolation', () => {
    it('keeps lines added on day A invisible on day B', () => {
      const { result, rerender } = renderHook(({ fecha }) => useCart(fecha), {
        initialProps: { fecha: DAY_A },
      });

      act(() => {
        result.current.addItem({ dish: makeDish(1, 2), sideId: null, sideNombre: null, notas: null });
      });
      expect(result.current.lines).toHaveLength(1);

      rerender({ fecha: DAY_B });

      expect(result.current.lines).toHaveLength(0);
      expect(result.current.totalCredits).toBe(0);
    });

    it('shows what was added to day A again after switching away and back', () => {
      const { result, rerender } = renderHook(({ fecha }) => useCart(fecha), {
        initialProps: { fecha: DAY_A },
      });

      act(() => {
        result.current.addItem({ dish: makeDish(1, 2), sideId: null, sideNombre: null, notas: null });
      });

      rerender({ fecha: DAY_B });
      expect(result.current.lines).toHaveLength(0);

      rerender({ fecha: DAY_A });
      expect(result.current.lines).toHaveLength(1);
      expect(result.current.totalCredits).toBe(2);
    });

    it('clears only the current day, leaving other days intact', () => {
      const { result, rerender } = renderHook(({ fecha }) => useCart(fecha), {
        initialProps: { fecha: DAY_A },
      });

      act(() => {
        result.current.addItem({ dish: makeDish(1, 2), sideId: null, sideNombre: null, notas: null });
      });

      rerender({ fecha: DAY_B });
      act(() => {
        result.current.addItem({ dish: makeDish(2, 3), sideId: null, sideNombre: null, notas: null });
      });

      rerender({ fecha: DAY_A });
      act(() => {
        result.current.clear();
      });
      expect(result.current.lines).toHaveLength(0);

      rerender({ fecha: DAY_B });
      expect(result.current.lines).toHaveLength(1);
      expect(result.current.totalCredits).toBe(3);
    });

    it('computes totalCredits independently per day', () => {
      const { result, rerender } = renderHook(({ fecha }) => useCart(fecha), {
        initialProps: { fecha: DAY_A },
      });

      act(() => {
        result.current.addItem({ dish: makeDish(1, 2), sideId: null, sideNombre: null, notas: null });
        result.current.addItem({ dish: makeDish(2, 3), sideId: null, sideNombre: null, notas: null });
      });
      expect(result.current.totalCredits).toBe(5);

      rerender({ fecha: DAY_B });
      act(() => {
        result.current.addItem({ dish: makeDish(3, 1), sideId: null, sideNombre: null, notas: null });
      });
      expect(result.current.totalCredits).toBe(1);

      rerender({ fecha: DAY_A });
      expect(result.current.totalCredits).toBe(5);
    });
  });
});
