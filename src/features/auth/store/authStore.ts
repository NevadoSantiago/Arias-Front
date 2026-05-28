import { create } from 'zustand';

export type Role = 'SUPER_ADMIN' | 'COMPANY_ADMIN' | 'EMPLOYEE';

export interface AuthUser {
  id: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: Role;
  companyId: number | null;
  companyName: string | null;
  categoryId: number | null;
}

interface AuthState {
  /** Access token JWT. Vive solo en memoria — NUNCA en localStorage. */
  accessToken: string | null;
  /** Datos del usuario logueado (vienen de GET /api/v1/auth/me). */
  user: AuthUser | null;
  /** True mientras estamos chequeando si hay sesión viva (al cargar la app). */
  bootstrapping: boolean;

  setAuth: (accessToken: string, user: AuthUser) => void;
  setAccessToken: (accessToken: string) => void;
  setUser: (user: AuthUser) => void;
  setBootstrapping: (b: boolean) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  bootstrapping: true,

  setAuth: (accessToken, user) => set({ accessToken, user }),
  setAccessToken: (accessToken) => set({ accessToken }),
  setUser: (user) => set({ user }),
  setBootstrapping: (bootstrapping) => set({ bootstrapping }),
  clear: () => set({ accessToken: null, user: null }),
}));

/** Selector helper para componentes que solo necesitan saber si hay sesión. */
export const useIsAuthenticated = () =>
  useAuthStore((s) => s.accessToken !== null && s.user !== null);
