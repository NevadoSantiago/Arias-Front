import { create } from 'zustand';

export type Role = 'SUPER_ADMIN' | 'COMPANY_ADMIN' | 'EMPLOYEE';

export interface AuthUser {
  id: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  /** Apodo elegido por el cliente; null si nunca cargó uno. */
  nickname: string | null;
  /**
   * Nombre con el que la cocina llama al cliente: apodo → nombre + apellido →
   * email. El backend lo manda siempre, pero un despliegue en otro orden (o un
   * rollback) puede omitirlo: por eso es opcional y `resolveCallName` aplica la
   * misma regla en el cliente.
   */
  displayName?: string | null;
  role: Role;
  companyId: number | null;
  companyName: string | null;
  categoryId: number | null;
  /** true si la cuenta ya validó su correo (verificación de correo o Google). */
  emailVerified: boolean;
  /** true si tiene teléfono y apodo. false hasta completar el perfil (alta con Google). */
  profileComplete: boolean;
  /**
   * Cuándo terminó o salteó el tour de primer ingreso; null = todavía no lo
   * vio. Opcional por la misma razón que `displayName`: un backend sin el campo
   * (despliegue en otro orden, rollback) no debe disparar el tour.
   */
  onboardingTourSeenAt?: string | null;
  /**
   * `true` si la cuenta recibió el almuerzo de bienvenida alguna vez (hecho por cuenta, de `/me`). Distinto
   * de `welcomeLunchGranted` de verify-email/google, que solo vale en la llamada que lo otorgó. `undefined`
   * (backend viejo o usuario cacheado) se trata como `true`: se conserva el tour de siempre.
   */
  receivedWelcomeLunch?: boolean;
}

interface AuthState {
  /** Access token JWT. Vive solo en memoria — NUNCA en localStorage. */
  accessToken: string | null;
  /** Datos del usuario logueado (vienen de GET /api/v1/auth/me). */
  user: AuthUser | null;
  /** True mientras estamos chequeando si hay sesión viva (al cargar la app). */
  bootstrapping: boolean;
  /**
   * El backend otorgó el almuerzo de bienvenida en un alta con Google y el
   * perfil todavía está incompleto: la felicitación se muestra recién al
   * terminar "Completá tu perfil". Solo en memoria — nunca se persiste.
   */
  pendingWelcomeLunch: boolean;

  setAuth: (accessToken: string, user: AuthUser) => void;
  setAccessToken: (accessToken: string) => void;
  setUser: (user: AuthUser) => void;
  setBootstrapping: (b: boolean) => void;
  setPendingWelcomeLunch: (v: boolean) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  bootstrapping: true,
  pendingWelcomeLunch: false,

  setAuth: (accessToken, user) => set({ accessToken, user }),
  setAccessToken: (accessToken) => set({ accessToken }),
  setUser: (user) => set({ user }),
  setBootstrapping: (bootstrapping) => set({ bootstrapping }),
  setPendingWelcomeLunch: (pendingWelcomeLunch) => set({ pendingWelcomeLunch }),
  clear: () => set({ accessToken: null, user: null, pendingWelcomeLunch: false }),
}));

/** Selector helper para componentes que solo necesitan saber si hay sesión. */
export const useIsAuthenticated = () =>
  useAuthStore((s) => s.accessToken !== null && s.user !== null);
