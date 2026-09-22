import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuthActions } from '../hooks/useAuthActions';
import { homeForRole } from './ProtectedRoute';
import type { Role } from '../store/authStore';

type Status = 'pending' | 'verifying' | 'verified' | 'error';

interface Props {
  /** Token del link de verificación (query param `?token=`), si vinimos desde el mail. */
  token: string | null;
  /** Email conocido (query param `?email=`), si vinimos desde el formulario de registro. */
  email: string | null;
}

/**
 * Pantalla de verificación de correo (spec self-registration, "UX de
 * verificación de correo electrónico" + "Pantalla de felicitación").
 *
 * Sin `token`: acabamos de registrarnos — mostramos "revisá tu correo" con
 * opción de reenvío, SIN loguear (paridad de enumeración: la respuesta de
 * reenvío es siempre neutra).
 *
 * Con `token`: confirmamos el correo contra el backend. Éxito → se establece
 * la sesión y mostramos la felicitación por el almuerzo de bienvenida
 * exactamente una vez, con un botón para continuar (a completar perfil o al
 * home según el rol).
 */
export function VerifyEmailStep({ token, email }: Props) {
  const [status, setStatus] = useState<Status>(token ? 'verifying' : 'pending');
  const [resendSent, setResendSent] = useState(false);
  const [resendPending, setResendPending] = useState(false);
  const { performVerifyEmail, performResendVerification } = useAuthActions();
  const navigate = useNavigate();
  const verifiedResult = useRef<{ profileComplete: boolean; role: Role } | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    (async () => {
      try {
        const result = await performVerifyEmail(token);
        if (cancelled) return;
        verifiedResult.current = result;
        setStatus('verified');
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo se ejecuta una vez por token
  }, [token]);

  const handleContinue = () => {
    const result = verifiedResult.current;
    if (!result) return;
    navigate(result.profileComplete ? homeForRole(result.role) : '/complete-profile', { replace: true });
  };

  const handleResend = async () => {
    if (!email) return;
    setResendPending(true);
    try {
      await performResendVerification(email);
    } finally {
      setResendPending(false);
      setResendSent(true);
    }
  };

  if (status === 'verifying') {
    return <p className="text-muted-foreground text-sm text-center py-10">Verificando tu cuenta…</p>;
  }

  if (status === 'verified') {
    return (
      <div className="text-center py-6">
        <h2 className="font-display text-foreground text-3xl font-bold mb-2">
          ¡Listo, bienvenido a Arias!
        </h2>
        <p className="text-muted-foreground text-sm mb-8">
          Tu correo quedó verificado y te regalamos 1 almuerzo de bienvenida 🎉
        </p>
        <Button
          onClick={handleContinue}
          className="w-full uppercase tracking-brand font-medium"
          size="lg"
        >
          Continuar
        </Button>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="text-center py-6">
        <h2 className="font-display text-foreground text-3xl font-bold mb-2">
          No pudimos verificarte
        </h2>
        <p className="text-destructive text-sm mb-6">
          El link de verificación es inválido o ya expiró.
        </p>
        <Link
          to="/register"
          className="text-xs text-muted-foreground hover:text-primary uppercase tracking-brand transition-colors"
        >
          Volver a registrarme
        </Link>
      </div>
    );
  }

  // status === 'pending' — venimos de registrarnos, todavía no abrimos el link del mail
  return (
    <div className="text-center py-6">
      <h2 className="font-display text-foreground text-3xl font-bold mb-2">Revisá tu correo</h2>
      <p className="text-muted-foreground text-sm mb-8">
        {email
          ? `Te enviamos un link de verificación a ${email}. Abrilo para activar tu cuenta.`
          : 'Te enviamos un link de verificación. Abrilo para activar tu cuenta.'}
      </p>

      {email && (
        <>
          <Button
            type="button"
            variant="outline"
            disabled={resendPending}
            onClick={handleResend}
            className="w-full uppercase tracking-brand font-medium"
            size="lg"
          >
            {resendPending ? 'Reenviando…' : 'Reenviar correo'}
          </Button>
          {resendSent && (
            <p className="text-muted-foreground text-xs mt-4">
              Si la cuenta existe y no está verificada, te reenviamos el correo.
            </p>
          )}
        </>
      )}
    </div>
  );
}
