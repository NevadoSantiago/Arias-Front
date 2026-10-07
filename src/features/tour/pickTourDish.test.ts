import { describe, expect, it } from 'vitest';
import { pickTourDish } from './pickTourDish';
import type { Dish } from '@/features/orders/types';

const make = (id: number, patch: Partial<Dish> = {}): Dish => ({
  id,
  nombre: `Plato ${id}`,
  descripcion: '',
  fotoUrl: null,
  category: { id: 1, nombre: 'Básico', parentId: null, creditCost: 1 },
  menuSection: { id: 1, nombre: 'Carnes', ordenDisplay: 1 },
  sideType: null,
  allowedSides: [],
  stockActual: 5,
  especial: false,
  ...patch,
});

const withSide = (id: number, patch: Partial<Dish> = {}) =>
  make(id, {
    sideType: 'GUARNICION',
    allowedSides: [{ id: 1, nombre: 'Papas', tipo: 'GUARNICION', enabled: true }],
    ...patch,
  });

describe('pickTourDish', () => {
  it('prefers the first in-stock dish that has a side, so the side step is shown', () => {
    const picked = pickTourDish([make(1), withSide(2), withSide(3)], { checkStock: true });

    expect(picked).toEqual({ dishId: 2, hasSide: true });
  });

  it('falls back to the first in-stock dish when none has a side', () => {
    const picked = pickTourDish([make(1, { stockActual: 0 }), make(2), make(3)], { checkStock: true });

    expect(picked).toEqual({ dishId: 2, hasSide: false });
  });

  it('ignores a side whose options are all disabled', () => {
    const dish = withSide(1, {
      allowedSides: [{ id: 1, nombre: 'Papas', tipo: 'GUARNICION', enabled: false }],
    });

    expect(pickTourDish([dish], { checkStock: true })).toEqual({ dishId: 1, hasSide: false });
  });

  it('skips out-of-stock dishes when checking stock', () => {
    expect(pickTourDish([withSide(1, { stockActual: 0 })], { checkStock: true })).toBeNull();
  });

  it('ignores stock for future days, where it does not apply', () => {
    expect(pickTourDish([withSide(1, { stockActual: 0 })], { checkStock: false })).toEqual({
      dishId: 1,
      hasSide: true,
    });
  });

  it('returns null when there are no dishes', () => {
    expect(pickTourDish([], { checkStock: true })).toBeNull();
  });
});
