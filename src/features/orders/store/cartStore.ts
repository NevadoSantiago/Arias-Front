import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import { useAuthStore } from '@/features/auth/store/authStore';
import type { CartLine } from '../hooks/useCart';

interface CartState {
  /** Id del usuario dueño del carrito; null si nadie lo armó todavía. */
  ownerId: number | null;
  /** Carrito por día (`fecha`), tal como lo pide F12. */
  byDate: Record<string, CartLine[]>;

  addLine: (fecha: string, line: CartLine) => void;
  removeLine: (fecha: string, localId: string) => void;
  clearDay: (fecha: string) => void;
  reset: () => void;
}

/**
 * `sessionStorage` puede fallar (modo privado, cuota llena, acceso denegado):
 * cada operación se envuelve para caer a memoria sin romper la pantalla.
 */
const safeSessionStorage: StateStorage = {
  getItem: (name) => {
    try {
      return window.sessionStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      window.sessionStorage.setItem(name, value);
    } catch {
      /* sin persistencia: el carrito sigue vivo en memoria */
    }
  },
  removeItem: (name) => {
    try {
      window.sessionStorage.removeItem(name);
    } catch {
      /* idem */
    }
  },
};

/** Sube al cambiar la forma de lo guardado: un payload de otra versión se descarta. */
const CART_STORAGE_VERSION = 1;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** JSON omite las claves `undefined`: una clave ausente vale null; un tipo equivocado no. */
const isAbsentOr = (value: unknown, type: 'string' | 'number') =>
  value === undefined || value === null || typeof value === type;

/** Una línea sirve si trae lo que el carrito lee: id local, plato con nombre y costo, y los datos del acompañamiento. */
function isValidLine(value: unknown): value is CartLine {
  if (!isRecord(value) || typeof value.localId !== 'string') return false;
  if (!isAbsentOr(value.sideId, 'number')) return false;
  if (!isAbsentOr(value.sideNombre, 'string') || !isAbsentOr(value.notas, 'string')) return false;
  const dish = value.dish;
  if (!isRecord(dish) || !isRecord(dish.category) || typeof dish.nombre !== 'string') return false;
  const cost = dish.category.creditCost;
  return typeof dish.id === 'number' && typeof cost === 'number' && Number.isFinite(cost);
}

/** Las claves opcionales ausentes se guardan como null, la forma que lee el resto de la app. */
const normalizeLine = (line: CartLine): CartLine => ({
  ...line,
  sideId: line.sideId ?? null,
  sideNombre: line.sideNombre ?? null,
  notas: line.notas ?? null,
});

/**
 * Lo que vuelve de `sessionStorage` es texto ajeno: se conserva solo lo que
 * tiene la forma esperada y el resto se descarta, para que un JSON raro nunca
 * rompa la página.
 */
function sanitizePersisted(persisted: unknown): Pick<CartState, 'ownerId' | 'byDate'> {
  const empty = { ownerId: null, byDate: {} };
  if (!isRecord(persisted) || !isRecord(persisted.byDate)) return empty;
  const ownerId = persisted.ownerId;
  if (ownerId !== null && typeof ownerId !== 'number') return empty;
  const byDate: Record<string, CartLine[]> = {};
  for (const [fecha, lines] of Object.entries(persisted.byDate)) {
    if (!ISO_DATE.test(fecha) || !Array.isArray(lines)) continue;
    const valid = lines.filter(isValidLine).map(normalizeLine);
    if (valid.length > 0) byDate[fecha] = valid;
  }
  return { ownerId, byDate };
}

const currentUserId = () => useAuthStore.getState().user?.id ?? null;

/** Con un usuario en sesión solo se conserva un carrito que ya es suyo; uno ajeno o sin dueño no se adopta. */
function enforceOwnership(state: Pick<CartState, 'ownerId' | 'byDate'>): Pick<CartState, 'ownerId' | 'byDate'> {
  const user = currentUserId();
  return user !== null && state.ownerId !== user ? { ownerId: null, byDate: {} } : state;
}

/**
 * Carrito B2C que sobrevive a la navegación entre pantallas (F24). Vive en
 * `sessionStorage` (sobrevive a recargar la pestaña, no a cerrarla) y es del
 * usuario que lo armó: al cerrar sesión o entrar otro usuario se vacía.
 */
export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      ownerId: null,
      byDate: {},

      addLine: (fecha, line) =>
        set((state) => {
          const owner = currentUserId();
          // Con usuario, solo se sigue un carrito que ya es suyo: uno de otro usuario
          // o sin dueño se descarta, nunca se adopta.
          const base = owner !== null && state.ownerId !== owner ? {} : state.byDate;
          return { ownerId: owner ?? state.ownerId, byDate: { ...base, [fecha]: [...(base[fecha] ?? []), line] } };
        }),
      removeLine: (fecha, localId) =>
        set((state) => ({
          byDate: { ...state.byDate, [fecha]: (state.byDate[fecha] ?? []).filter((l) => l.localId !== localId) },
        })),
      clearDay: (fecha) => set((state) => ({ byDate: { ...state.byDate, [fecha]: [] } })),
      reset: () => set({ ownerId: null, byDate: {} }),
    }),
    {
      name: 'arias-b2c-cart',
      storage: createJSONStorage(() => safeSessionStorage),
      version: CART_STORAGE_VERSION,
      // Otra versión: se descarta en vez de adivinar la forma vieja.
      migrate: () => ({ ownerId: null, byDate: {} }),
      merge: (persisted, current) => ({ ...current, ...enforceOwnership(sanitizePersisted(persisted)) }),
    },
  ),
);

/** Cierre de sesión o cambio de usuario: el carrito anterior nunca se ve. */
useAuthStore.subscribe((state, prev) => {
  const next = state.user?.id ?? null;
  const before = prev.user?.id ?? null;
  const cart = useCartStore.getState();
  if (before !== null && next === null) {
    cart.reset();
  } else if (next !== null && cart.ownerId !== next) {
    // Dueño distinto o ninguno: un carrito armado sin usuario tampoco se hereda.
    cart.reset();
  }
});
