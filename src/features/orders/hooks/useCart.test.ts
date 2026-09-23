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

describe('useCart', () => {
  it('starts empty with a total of 0', () => {
    const { result } = renderHook(() => useCart());

    expect(result.current.lines).toHaveLength(0);
    expect(result.current.totalCredits).toBe(0);
  });

  it('sums each line credit cost from dish.category.creditCost — never a hardcoded price', () => {
    const { result } = renderHook(() => useCart());

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
    const { result } = renderHook(() => useCart());
    const dish = makeDish(1, 2);

    act(() => {
      result.current.addItem({ dish, sideId: null, sideNombre: null, notas: null });
      result.current.addItem({ dish, sideId: null, sideNombre: null, notas: null });
    });

    expect(result.current.lines).toHaveLength(2);
    expect(result.current.totalCredits).toBe(4);
  });

  it('recomputes the total after removing a line', () => {
    const { result } = renderHook(() => useCart());

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
    const { result } = renderHook(() => useCart());

    act(() => {
      result.current.addItem({ dish: makeDish(1, 2), sideId: null, sideNombre: null, notas: null });
    });
    act(() => {
      result.current.clear();
    });

    expect(result.current.lines).toHaveLength(0);
    expect(result.current.totalCredits).toBe(0);
  });
});
