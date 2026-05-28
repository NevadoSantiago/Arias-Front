import axios, { type AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/features/auth/store/authStore';

/**
 * Cliente axios para hablar con el backend de Arias.
 *
 * En DEV: usa el proxy de Vite ({@code /api → http://localhost:8080}),
 * por lo que el browser ve todo como same-origin (sin CORS ni problemas de cookie).
 *
 * En PROD: VITE_API_URL apunta al dominio del backend (ej: https://api.arias.com).
 * Como front y back comparten dominio padre (arias.com), la cookie httpOnly
 * de refresh viaja sin problemas con SameSite=Strict.
 */
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '',
  withCredentials: true,
});

// ─── Request interceptor: adjunta Bearer token ─────────────────────────
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Response interceptor: refresh automático en 401 ───────────────────
//
// Flujo:
//   1. Request original recibe 401
//   2. Si NO es endpoint de auth → intentamos refresh (una sola vez)
//   3. Mientras el refresh está en vuelo, otras requests 401 esperan en cola
//   4. Si refresh OK → reintentamos la request original + las en cola con el nuevo token
//   5. Si refresh falla → limpiamos store y redirigimos a /login

interface RetriableRequestConfig extends InternalAxiosRequestConfig {
  _retried?: boolean;
}

type ResolveFn = (token: string) => void;
type RejectFn = (err: unknown) => void;

let isRefreshing = false;
let waiters: Array<{ resolve: ResolveFn; reject: RejectFn }> = [];

function processQueue(error: unknown, token: string | null) {
  waiters.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else if (token) resolve(token);
  });
  waiters = [];
}

function isAuthEndpoint(url: string | undefined): boolean {
  if (!url) return false;
  return url.includes('/api/v1/auth/login')
      || url.includes('/api/v1/auth/refresh')
      || url.includes('/api/v1/auth/first-login')
      || url.includes('/api/v1/auth/check-email')
      || url.includes('/api/v1/auth/logout');
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetriableRequestConfig | undefined;
    const status = error.response?.status;

    // Si el backend devolvió un problem+json con `detail`, reemplazamos el
    // error.message por ese texto. Los catchers (try/catch en mutations,
    // forms, etc.) reciben directamente el mensaje human-readable.
    const detail = (error.response?.data as { detail?: string } | undefined)?.detail;
    if (detail) {
      error.message = detail;
    }

    // Solo intentamos refresh ante un 401 de un endpoint NO-auth, y una sola vez
    if (status !== 401 || !original || original._retried || isAuthEndpoint(original.url)) {
      return Promise.reject(error);
    }

    original._retried = true;

    // Si ya hay un refresh en vuelo → encolar
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        waiters.push({
          resolve: (token: string) => {
            original.headers.Authorization = `Bearer ${token}`;
            resolve(api(original as AxiosRequestConfig));
          },
          reject,
        });
      });
    }

    isRefreshing = true;

    try {
      const { data } = await axios.post<{ accessToken: string }>(
        `${api.defaults.baseURL}/api/v1/auth/refresh`,
        {},
        { withCredentials: true }
      );

      const newToken = data.accessToken;
      useAuthStore.getState().setAccessToken(newToken);

      // Liberar la cola con el nuevo token
      processQueue(null, newToken);

      // Reintentar la request original
      original.headers.Authorization = `Bearer ${newToken}`;
      return api(original as AxiosRequestConfig);
    } catch (refreshError) {
      processQueue(refreshError, null);
      useAuthStore.getState().clear();

      // Redirigir a login solo si NO estamos ya ahí
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }

      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);
