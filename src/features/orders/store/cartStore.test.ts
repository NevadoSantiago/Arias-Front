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

describe('cartStore — an ownerless cart is never adopted', () => {
  beforeEach(() => window.sessionStorage.clear());
  afterEach(() => window.sessionStorage.clear());

  it('discards a stored cart with no owner when a signed-in user adds a line', async () => {
    vi.resetModules();
    window.sessionStorage.setItem(
      KEY,
      JSON.stringify({ state: { ownerId: null, byDate: { '2026-06-01': [validLine] } }, version: 1 }),
    );
    // Sesión ya iniciada al cargar: el suscriptor de auth no dispara ningún reseteo.
    const { useAuthStore } = await import('@/features/auth/store/authStore');
    useAuthStore.setState({ user: { id: 9 } as never });
    const { useCartStore } = await import('./cartStore');
    // La garantía vale al rehidratar, no solo en addLine (F27.1).
    expect(useCartStore.getState().byDate).toEqual({});
    expect(useCartStore.getState().ownerId).toBeNull();

    useCartStore.getState().addLine('2026-06-02', { ...validLine, localId: 'new' } as never);

    const { ownerId, byDate } = useCartStore.getState();
    expect(ownerId).toBe(9);
    expect(byDate['2026-06-01']).toBeUndefined();
    expect(byDate['2026-06-02']).toHaveLength(1);
    useAuthStore.setState({ user: null });
  });

  it('clears a rehydrated cart owned by another user when a user is signed in', async () => {
    vi.resetModules();
    window.sessionStorage.setItem(
      KEY,
      JSON.stringify({ state: { ownerId: 3, byDate: { '2026-06-01': [validLine] } }, version: 1 }),
    );
    const { useAuthStore } = await import('@/features/auth/store/authStore');
    useAuthStore.setState({ user: { id: 9 } as never });
    const { useCartStore } = await import('./cartStore');

    expect(useCartStore.getState().byDate).toEqual({});
    useAuthStore.setState({ user: null });
  });

  it('keeps a rehydrated cart owned by the signed-in user', async () => {
    vi.resetModules();
    window.sessionStorage.setItem(
      KEY,
      JSON.stringify({ state: { ownerId: 9, byDate: { '2026-06-01': [validLine] } }, version: 1 }),
    );
    const { useAuthStore } = await import('@/features/auth/store/authStore');
    useAuthStore.setState({ user: { id: 9 } as never });
    const { useCartStore } = await import('./cartStore');

    expect(useCartStore.getState().byDate['2026-06-01']).toHaveLength(1);
    useAuthStore.setState({ user: null });
  });

  it('clears an ownerless cart on sign-in', async () => {
    vi.resetModules();
    const { useAuthStore } = await import('@/features/auth/store/authStore');
    const { useCartStore } = await import('./cartStore');
    useCartStore.setState({ ownerId: null, byDate: { '2026-06-01': [validLine as never] } });

    useAuthStore.setState({ user: { id: 9 } as never });

    expect(useCartStore.getState().byDate).toEqual({});
    useAuthStore.setState({ user: null });
  });
});

describe('cartStore — deeper line validation', () => {
  beforeEach(() => window.sessionStorage.clear());
  afterEach(() => window.sessionStorage.clear());

  it.each([
    ['dish.nombre is not a string', { ...validLine, dish: { ...validLine.dish, nombre: 5 } }],
    ['sideId is a string', { ...validLine, sideId: 'x' }],
    ['sideNombre is a number', { ...validLine, sideNombre: 3 }],
    ['notas is a number', { ...validLine, notas: 3 }],
  ])('drops a line when %s', async (_name, line) => {
    const store = await loadStore({ ownerId: 7, byDate: { '2026-06-01': [validLine, line] } });

    expect(store.getState().byDate['2026-06-01']).toEqual([validLine]);
  });

  it('keeps a line with a numeric sideId and string side and notes', async () => {
    const full = { ...validLine, sideId: 4, sideNombre: 'Papas', notas: 'sin sal' };
    const store = await loadStore({ ownerId: 7, byDate: { '2026-06-01': [full] } });

    expect(store.getState().byDate['2026-06-01']).toEqual([full]);
  });

  it('normalizes absent sideId, sideNombre and notas to null instead of dropping the line (F27.1)', async () => {
    // JSON.stringify omite las claves undefined: así quedan guardadas las líneas viejas.
    const { sideId: _s, sideNombre: _n, notas: _o, ...bare } = validLine;
    const store = await loadStore({ ownerId: 7, byDate: { '2026-06-01': [bare] } });

    expect(store.getState().byDate['2026-06-01']).toEqual([validLine]);
  });

  it('still drops a line whose optional keys have the wrong type even when others are absent', async () => {
    const { sideNombre: _n, ...bare } = validLine;
    const store = await loadStore({ ownerId: 7, byDate: { '2026-06-01': [{ ...bare, notas: 3 }] } });

    expect(store.getState().byDate['2026-06-01']).toBeUndefined();
  });

  it('drops days whose key is not an ISO date', async () => {
    const store = await loadStore({
      ownerId: 7,
      byDate: { mañana: [validLine], '2026-6-1': [validLine], '2026-06-01': [validLine] },
    });

    expect(Object.keys(store.getState().byDate)).toEqual(['2026-06-01']);
  });
});
