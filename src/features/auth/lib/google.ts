/** Código que devuelve `/auth/google` (HTTP 403) cuando la cuenta no es de un cliente B2C. */
export const GOOGLE_ACCOUNT_NOT_ALLOWED = 'GOOGLE_ACCOUNT_NOT_ALLOWED';

/** true si el error de axios es el rechazo específico para cuentas de empresa/admin. */
export function isGoogleAccountNotAllowed(err: unknown): boolean {
  if (typeof err !== 'object' || err === null || !('response' in err)) return false;
  const response = (err as { response?: { status?: number; data?: { errorCode?: string } } }).response;
  return response?.status === 403 && response.data?.errorCode === GOOGLE_ACCOUNT_NOT_ALLOWED;
}

/**
 * Lee el email del payload del ID token de Google (JWT) sin verificarlo: solo
 * sirve para pre-cargar el campo de email, la validación real es del backend.
 * Falla en silencio (undefined) si el token no se puede decodificar.
 */
export function decodeGoogleCredentialEmail(credential: string): string | undefined {
  try {
    const payload = credential.split('.')[1];
    if (!payload) return undefined;
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    const bytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
    const json = JSON.parse(new TextDecoder().decode(bytes)) as { email?: unknown };
    return typeof json.email === 'string' && json.email ? json.email : undefined;
  } catch {
    return undefined;
  }
}
