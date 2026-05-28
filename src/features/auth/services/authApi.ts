import { api } from '@/lib/api';
import type { AuthUser } from '../store/authStore';

const BASE = '/api/v1/auth';

// ─── Errores tipados ──────────────────────────────────────────────────

/** Error de credenciales — se mapea desde el 401 de problem+json del backend. */
export class InvalidCredentialsError extends Error {
  constructor() {
    super('Email o contraseña incorrectos.');
    this.name = 'InvalidCredentialsError';
  }
}

// ─── Tipos de respuesta del backend ───────────────────────────────────

export interface CheckEmailResponse {
  requiresFirstLogin: boolean;
}

interface TokenResponse {
  accessToken: string;
}

// ─── Endpoints ────────────────────────────────────────────────────────

export async function checkEmail(email: string): Promise<CheckEmailResponse> {
  const { data } = await api.post<CheckEmailResponse>(
    `${BASE}/check-email`,
    { email }
  );
  return data;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export async function login(payload: LoginPayload): Promise<string> {
  try {
    const { data } = await api.post<TokenResponse>(`${BASE}/login`, payload);
    return data.accessToken;
  } catch (err) {
    throw mapAuthError(err);
  }
}

export interface FirstLoginPayload {
  email: string;
  firstName: string;
  lastName?: string;
  password: string;
}

export async function firstLogin(payload: FirstLoginPayload): Promise<string> {
  try {
    const { data } = await api.post<TokenResponse>(`${BASE}/first-login`, payload);
    return data.accessToken;
  } catch (err) {
    throw mapAuthError(err);
  }
}

/**
 * Refresh manual (sin pasar por el interceptor — usado en el bootstrap inicial).
 * El interceptor de api.ts también hace refresh automático en 401.
 */
export async function refresh(): Promise<string> {
  const { data } = await api.post<TokenResponse>(`${BASE}/refresh`);
  return data.accessToken;
}

export async function logout(): Promise<void> {
  await api.post(`${BASE}/logout`);
}

export async function me(): Promise<AuthUser> {
  const { data } = await api.get<AuthUser>(`${BASE}/me`);
  return data;
}

// ─── Password reset ──────────────────────────────────────────────────

export async function forgotPassword(email: string): Promise<void> {
  await api.post(`${BASE}/forgot-password`, { email });
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  await api.post(`${BASE}/reset-password`, { token, newPassword });
}

// ─── Helpers ──────────────────────────────────────────────────────────

function mapAuthError(err: unknown): Error {
  if (typeof err === 'object' && err !== null && 'response' in err) {
    const status = (err as { response?: { status?: number } }).response?.status;
    if (status === 401) return new InvalidCredentialsError();
  }
  return err instanceof Error ? err : new Error('Error de red');
}
