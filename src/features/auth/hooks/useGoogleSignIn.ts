import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthActions } from './useAuthActions';
import { homeForRole } from '../components/ProtectedRoute';
import { decodeGoogleCredentialEmail, isGoogleAccountNotAllowed } from '../lib/google';
import type { Role } from '../store/authStore';

export const GOOGLE_GENERIC_ERROR = 'No pudimos iniciar sesión con Google. Probá de nuevo.';

interface SignInResult {
  profileComplete: boolean;
  role: Role;
}

export type GoogleSignInProblem =
  /** Cuenta de empresa/admin: Google no aplica. `email` sale del ID token, si se pudo leer. */
  | { kind: 'excluded'; email?: string }
  | { kind: 'error' };

/**
 * Flujo de Google compartido por login y registro: canjea el ID token y navega
 * según el perfil. La felicitación por el almuerzo de bienvenida NO se muestra
 * acá: `performGoogleLogin` deja `pendingWelcomeLunch` armado y aparece al
 * terminar "Completá tu perfil". Los rechazos se exponen como `problem`; un popup cancelado no
 * dispara ningún callback, así que la pantalla queda como estaba.
 */
export function useGoogleSignIn() {
  const navigate = useNavigate();
  const { performGoogleLogin } = useAuthActions();
  const [problem, setProblem] = useState<GoogleSignInProblem | null>(null);

  const goAfterSignIn = (result: SignInResult) =>
    navigate(result.profileComplete ? homeForRole(result.role) : '/complete-profile', { replace: true });

  const onSuccess = async (idToken: string) => {
    setProblem(null);
    try {
      const result = await performGoogleLogin(idToken);
      goAfterSignIn(result);
    } catch (err) {
      setProblem(
        isGoogleAccountNotAllowed(err)
          ? { kind: 'excluded', email: decodeGoogleCredentialEmail(idToken) }
          : { kind: 'error' },
      );
    }
  };

  const onError = () => setProblem({ kind: 'error' });

  return { onSuccess, onError, problem };
}

export type GoogleSignIn = ReturnType<typeof useGoogleSignIn>;
