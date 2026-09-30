import { useLayoutEffect, useRef, useState } from 'react';
import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

/** GSI acepta un ancho en px entre 200 y 400. */
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;
const FALLBACK_WIDTH = 280;

interface Props {
  onSuccess: (idToken: string) => void;
  onError?: () => void;
}

/**
 * Botón "Continuar con Google" (spec self-registration, "Botón de inicio de
 * sesión con Google como método prioritario"). Usa solo las opciones propias
 * de Google (sin botón custom); el ancho se ajusta al del contenedor porque
 * GSI solo acepta px.
 *
 * Envuelve su propio {@link GoogleOAuthProvider} en vez de forzar el client
 * id en toda la app — así solo las pantallas de auth pagan el costo de
 * cargar el SDK de Google. Si `VITE_GOOGLE_CLIENT_ID` no está configurada
 * (ej: dev local sin credenciales), el botón se oculta en vez de romper el
 * resto del formulario.
 */
export function GoogleLoginButton({ onSuccess, onError }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(FALLBACK_WIDTH);

  useLayoutEffect(() => {
    const measured = containerRef.current?.clientWidth ?? 0;
    if (measured > 0) {
      setWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.floor(measured))));
    }
  }, []);

  if (!GOOGLE_CLIENT_ID) {
    return null;
  }

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID} locale="es">
      <div ref={containerRef} className="flex w-full justify-center">
        <GoogleLogin
          onSuccess={(credentialResponse) => {
            if (credentialResponse.credential) {
              onSuccess(credentialResponse.credential);
            } else {
              onError?.();
            }
          }}
          onError={() => onError?.()}
          theme="outline"
          size="large"
          text="continue_with"
          shape="rectangular"
          width={width}
        />
      </div>
    </GoogleOAuthProvider>
  );
}
