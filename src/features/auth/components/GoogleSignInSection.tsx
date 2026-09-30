import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { GOOGLE_GENERIC_ERROR, type GoogleSignIn } from '../hooks/useGoogleSignIn';
import { GoogleLoginButton } from './GoogleLoginButton';

interface Props {
  google: GoogleSignIn;
  /** En el registro, una cuenta de empresa se deriva al login en vez de registrarse. */
  mode: 'login' | 'register';
  /** Texto del separador entre el botón de Google y el formulario de email. */
  dividerLabel: string;
}

/**
 * Botón de Google + aviso de cuenta excluida / error genérico + separador.
 * Se oculta por completo si no hay `VITE_GOOGLE_CLIENT_ID`, separador incluido.
 */
export function GoogleSignInSection({ google, mode, dividerLabel }: Props) {
  if (!import.meta.env.VITE_GOOGLE_CLIENT_ID) return null;

  const { problem } = google;
  const loginHref =
    problem?.kind === 'excluded' && problem.email
      ? `/login?email=${encodeURIComponent(problem.email)}`
      : '/login';

  return (
    <>
      <div className="space-y-3">
        <GoogleLoginButton onSuccess={google.onSuccess} onError={google.onError} />

        {problem?.kind === 'excluded' && (
          <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-foreground" role="status">
            <p>
              <strong className="font-semibold">Tu cuenta es de empresa.</strong> Ingresá con tu email.
            </p>
            {mode === 'register' && (
              <>
                <p className="mt-1 text-muted-foreground">No hace falta registrarte.</p>
                <Button asChild variant="outline" size="sm" className="mt-3 w-full">
                  <Link to={loginHref}>Ir a iniciar sesión</Link>
                </Button>
              </>
            )}
          </div>
        )}

        {problem?.kind === 'error' && <p className="text-destructive text-xs">{GOOGLE_GENERIC_ERROR}</p>}
      </div>

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-card px-2 text-muted-foreground uppercase tracking-brand">{dividerLabel}</span>
        </div>
      </div>
    </>
  );
}
