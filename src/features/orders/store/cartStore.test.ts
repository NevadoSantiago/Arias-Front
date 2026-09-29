import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const KEY = 'arias-b2c-cart';

const validLine = {
  localId: '1-0-1',
  dish: { id: 1, nombre: 'Plato 1', category: { id: 1, nombre: 'Básico', parentId: null, creditCost: 2 } },
  sideId: null,
  sideNombre: null,
  notas: null,
};

/** Carga el store desde cero, como al recargar la pestaña, con lo que haya en sessionStorage. */
async function loadStore(stored?: unknown, version = 1) {
  vi.resetModules();
  if (stored !== undefined) {
    window.sessionStorage.setItem(KEY, typeof stored === 'string' ? stored : JSON.stringify({ state: stored, version }));
  }
  const { useCartStore } = await import('./cartStore');
  return useCartStore;
}

describe('cartStore — rehydration is validated', () => {
  beforeEach(() => window.sessionStorage.clear());
  afterEach(() => window.sessionStorage.clear());

  it('keeps a well-formed stored cart', async () => {
    const store = await loadStore({ ownerId: 7, byDate: { '2026-06-01': [validLine] } });

    expect(store.getState().ownerId).toBe(7);
    expect(store.getState().byDate['2026-06-01']).toHaveLength(1);
  });

  it('starts empty when the stored text is not JSON', async () => {
    const store = await loadStore('{not json');

    expect(store.getState().ownerId).toBeNull();
    expect(store.getState().byDate).toEqual({});
  });

  it.each([
    ['byDate is not an object', { ownerId: 7, byDate: 'x' }],
    ['byDate is an array', { ownerId: 7, byDate: [] }],
    ['ownerId is not a number', { ownerId: 'seven', byDate: {} }],
    ['the state is null', null],
  ])('starts empty when %s', async (_name, state) => {
    const store = await loadStore(state);

    expect(store.getState().ownerId).toBeNull();
    expect(store.getState().byDate).toEqual({});
  });

  it('drops days whose lines are not an array and lines missing the fields the cart needs', async () => {
    const noCost = { ...validLine, localId: 'x', dish: { ...validLine.dish, category: { id: 1 } } };
    const noDish = { localId: 'y', sideId: null, sideNombre: null, notas: null };
    const store = await loadStore({
      ownerId: 7,
      byDate: {
        '2026-06-01': [validLine, noCost, noDish, null, 3],
        '2026-06-02': 'nope',
        '2026-06-03': [noCost],
      },
    });

    expect(store.getState().ownerId).toBe(7);
    expect(store.getState().byDate['2026-06-01']).toEqual([validLine]);
    expect(store.getState().byDate['2026-06-02']).toBeUndefined();
    expect(store.getState().byDate['2026-06-03']).toBeUndefined();
  });

  it('discards a payload written by another schema version', async () => {
    const store = await loadStore({ ownerId: 7, byDate: { '2026-06-01': [validLine] } }, 0);

    expect(store.getState().ownerId).toBeNull();
    expect(store.getState().byDate).toEqual({});
  });
});
