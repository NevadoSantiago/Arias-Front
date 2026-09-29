import type { AuthUser } from '../store/authStore';

type CallNameSource = Pick<AuthUser, 'email' | 'firstName' | 'lastName' | 'nickname'> & {
  /** El backend lo manda siempre, pero un despliegue en otro orden (o un rollback) puede omitirlo. */
  displayName?: string | null;
};

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
