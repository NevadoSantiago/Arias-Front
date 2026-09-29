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

/** Una línea sirve si trae lo que el carrito lee: id local y costo del plato. */
function isValidLine(value: unknown): value is CartLine {
  if (!isRecord(value) || typeof value.localId !== 'string') return false;
  const dish = value.dish;
  if (!isRecord(dish) || !isRecord(dish.category)) return false;
  const cost = dish.category.creditCost;
  return typeof dish.id === 'number' && typeof cost === 'number' && Number.isFinite(cost);
}

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
    if (!Array.isArray(lines)) continue;
    const valid = lines.filter(isValidLine);
    if (valid.length > 0) byDate[fecha] = valid;
  }
  return { ownerId, byDate };
}

const currentUserId = () => useAuthStore.getState().user?.id ?? null;

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
          // Si el carrito era de otro usuario, no se mezcla: se arranca de cero.
          const base = owner !== null && state.ownerId !== owner && state.ownerId !== null ? {} : state.byDate;
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
      merge: (persisted, current) => ({ ...current, ...sanitizePersisted(persisted) }),
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
