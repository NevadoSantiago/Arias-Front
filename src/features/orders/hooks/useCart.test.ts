import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore, type AuthUser } from '@/features/auth/store/authStore';
import { useCartStore } from '../store/cartStore';
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

// El carrito es un store global: cada test arranca vacío (ya no lo hace `setup.ts`).
afterEach(() => useCartStore.getState().reset());

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

    it('removes a line only from the current day', () => {
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
      const onDayB = result.current.lines[0].localId;

      act(() => {
        result.current.removeItem(onDayB);
      });
      expect(result.current.lines).toHaveLength(0);

      rerender({ fecha: DAY_A });
      expect(result.current.lines).toHaveLength(1);
      expect(result.current.totalCredits).toBe(2);
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

const userA: AuthUser = {
  id: 1,
  email: 'a@example.com',
  firstName: 'A',
  lastName: null,
  nickname: null,
  role: 'EMPLOYEE',
  companyId: null,
  companyName: null,
  categoryId: null,
  emailVerified: true,
  profileComplete: true,
};
const userB: AuthUser = { ...userA, id: 2, email: 'b@example.com' };

const input = (id: number, cost = 2) => ({
  dish: makeDish(id, cost),
  sideId: null,
  sideNombre: null,
  notas: null,
});

/**
 * F24: el carrito vive en un store (sessionStorage, por usuario) y no en el
 * `useState` de la página, para sobrevivir a la navegación entre pantallas.
 */
describe('useCart — persistence across navigation (F24)', () => {
  it('keeps the lines after the consumer unmounts and mounts again', () => {
    useAuthStore.setState({ accessToken: 't', user: userA, bootstrapping: false });
    const first = renderHook(() => useCart(DAY_A));
    act(() => first.result.current.addItem(input(1)));
    first.unmount();

    const second = renderHook(() => useCart(DAY_A));

    expect(second.result.current.lines).toHaveLength(1);
    expect(second.result.current.lines[0].dish.id).toBe(1);
    expect(second.result.current.totalCredits).toBe(2);
  });

  it('persists to sessionStorage so a reload in the same tab keeps it', () => {
    useAuthStore.setState({ accessToken: 't', user: userA, bootstrapping: false });
    const { result } = renderHook(() => useCart(DAY_A));
    act(() => result.current.addItem(input(1)));

    const raw = window.sessionStorage.getItem('arias-b2c-cart');
    expect(raw).not.toBeNull();
    expect(raw).toContain('Plato 1');
    expect(window.localStorage.getItem('arias-b2c-cart')).toBeNull();
  });

  it('keeps each day separate after remounting', () => {
    useAuthStore.setState({ accessToken: 't', user: userA, bootstrapping: false });
    const a = renderHook(() => useCart(DAY_A));
    act(() => a.result.current.addItem(input(1)));
    const b = renderHook(() => useCart(DAY_B));
    act(() => b.result.current.addItem(input(2)));
    a.unmount();
    b.unmount();

    expect(renderHook(() => useCart(DAY_A)).result.current.lines.map((l) => l.dish.id)).toEqual([1]);
    expect(renderHook(() => useCart(DAY_B)).result.current.lines.map((l) => l.dish.id)).toEqual([2]);
  });

  it('empties the cart on logout', () => {
    useAuthStore.setState({ accessToken: 't', user: userA, bootstrapping: false });
    const { result } = renderHook(() => useCart(DAY_A));
    act(() => result.current.addItem(input(1)));

    act(() => useAuthStore.getState().clear());

    expect(result.current.lines).toHaveLength(0);
    expect(window.sessionStorage.getItem('arias-b2c-cart') ?? '').not.toContain('Plato 1');
  });

  it('never shows a previous user cart to a different user', () => {
    useAuthStore.setState({ accessToken: 't', user: userA, bootstrapping: false });
    const { result } = renderHook(() => useCart(DAY_A));
    act(() => result.current.addItem(input(1)));

    act(() => useAuthStore.getState().setAuth('t2', userB));

    expect(result.current.lines).toHaveLength(0);
    expect(renderHook(() => useCart(DAY_A)).result.current.lines).toHaveLength(0);
  });

  it('keeps the cart when the same user is refreshed (setUser with the same id)', () => {
    useAuthStore.setState({ accessToken: 't', user: userA, bootstrapping: false });
    const { result } = renderHook(() => useCart(DAY_A));
    act(() => result.current.addItem(input(1)));

    act(() => useAuthStore.getState().setUser({ ...userA, nickname: 'Ale' }));

    expect(result.current.lines).toHaveLength(1);
  });

  it('clear() empties only the current day', () => {
    useAuthStore.setState({ accessToken: 't', user: userA, bootstrapping: false });
    const a = renderHook(() => useCart(DAY_A));
    act(() => a.result.current.addItem(input(1)));
    const b = renderHook(() => useCart(DAY_B));
    act(() => b.result.current.addItem(input(2)));

    act(() => a.result.current.clear());
    a.unmount();
    b.unmount();

    expect(renderHook(() => useCart(DAY_A)).result.current.lines).toHaveLength(0);
    expect(renderHook(() => useCart(DAY_B)).result.current.lines).toHaveLength(1);
  });

  it('falls back to memory without crashing when sessionStorage throws on write', () => {
    useAuthStore.setState({ accessToken: 't', user: userA, bootstrapping: false });
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    try {
      const { result } = renderHook(() => useCart(DAY_A));
      expect(() => act(() => result.current.addItem(input(1)))).not.toThrow();
      expect(result.current.lines).toHaveLength(1);
    } finally {
      setItem.mockRestore();
    }
  });

  it('starts empty and stays usable when sessionStorage throws on the startup read', async () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    try {
      vi.resetModules();
      const { useCartStore: fresh } = await import('../store/cartStore');
      expect(fresh.getState().byDate).toEqual({});
      expect(getItem).toHaveBeenCalled();
      expect(() => fresh.getState().addLine(DAY_A, { localId: 'a', ...input(1) })).not.toThrow();
      expect(fresh.getState().byDate[DAY_A]).toHaveLength(1);
    } finally {
      getItem.mockRestore();
    }
  });

  it('does not hand a cart built without a signed-in user to the next user who signs in', () => {
    act(() => useAuthStore.getState().clear());
    const { result } = renderHook(() => useCart(DAY_A));
    act(() => result.current.addItem(input(1)));
    expect(result.current.lines).toHaveLength(1);

    act(() => useAuthStore.getState().setAuth('t', userA));

    expect(result.current.lines).toHaveLength(0);
    expect(useCartStore.getState().byDate[DAY_A] ?? []).toHaveLength(0);
  });
});
