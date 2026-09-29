import type { AuthUser } from '../store/authStore';

type CallNameSource = Pick<AuthUser, 'email' | 'firstName' | 'lastName' | 'nickname' | 'displayName'>;

/**
 * Nombre con el que la cocina llama al cliente. Usa el `displayName` del
 * backend y, si no vino, aplica en el cliente la MISMA regla: apodo → nombre +
 * apellido → email.
 */
export function resolveCallName(user: CallNameSource): string {
  const fromBackend = user.displayName?.trim();
  if (fromBackend) return fromBackend;
  const nickname = user.nickname?.trim();
  if (nickname) return nickname;
  const fullName = [user.firstName, user.lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' ');
  return fullName || user.email;
}
