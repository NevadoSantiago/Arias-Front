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
          const base = state.ownerId !== null && owner !== null && state.ownerId !== owner ? {} : state.byDate;
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
  } else if (next !== null && cart.ownerId !== null && cart.ownerId !== next) {
    cart.reset();
  }
});
