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

export interface TokenResponse {
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

// ─── Autorregistro (self-registration) ────────────────────────────────

export interface RegisterPayload {
  firstName: string;
  lastName?: string;
  email: string;
  phone: string;
  nickname: string;
  password: string;
}

/**
 * Alta pública. La respuesta del backend es SIEMPRE el mismo mensaje neutro,
 * exista o no la cuenta — nunca la interpretamos como confirmación de que el
 * email es nuevo (paridad de enumeración de cuentas). Nunca devuelve sesión.
 */
export async function register(payload: RegisterPayload): Promise<void> {
  await api.post(`${BASE}/register`, payload);
}

/** Confirma el correo y, con eso, emite sesión (único punto que loguea en el flujo de registro). */
export async function verifyEmail(token: string): Promise<TokenResponse> {
  const { data } = await api.post<TokenResponse>(`${BASE}/verify-email`, { token });
  return data;
}

/** Reenvío del correo de verificación — respuesta neutra, misma protección de enumeración que `register`. */
export async function resendVerification(email: string): Promise<void> {
  await api.post(`${BASE}/resend-verification`, { email });
}

/** Alta/login con Google — el ID token se manda tal cual, el backend lo valida. Siempre emite sesión. */
export async function googleLogin(idToken: string): Promise<TokenResponse> {
  const { data } = await api.post<TokenResponse>(`${BASE}/google`, { idToken });
  return data;
}

export interface CompleteProfilePayload {
  phone: string;
  nickname: string;
}

/** Completa teléfono/apodo tras un alta por Google. Requiere sesión (Bearer). */
export async function completeProfile(payload: CompleteProfilePayload): Promise<AuthUser> {
  const { data } = await api.post<AuthUser>(`${BASE}/complete-profile`, payload);
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
