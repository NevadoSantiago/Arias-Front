import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

interface Props {
  onSuccess: (idToken: string) => void;
  onError?: () => void;
}

/**
 * Botón "Iniciar sesión con Google" (spec self-registration, "Botón de
 * inicio de sesión con Google como método prioritario").
 *
 * Envuelve su propio {@link GoogleOAuthProvider} en vez de forzar el client
 * id en toda la app — así solo el formulario de registro paga el costo de
 * cargar el SDK de Google. Si `VITE_GOOGLE_CLIENT_ID` no está configurada
 * (ej: dev local sin credenciales), el botón se oculta en vez de romper el
 * resto del formulario.
 */
export function GoogleLoginButton({ onSuccess, onError }: Props) {
  if (!GOOGLE_CLIENT_ID) {
    return null;
  }

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID} locale="es">
      <div className="flex w-full justify-center [&>div]:w-full">
        <GoogleLogin
          onSuccess={(credentialResponse) => {
            if (credentialResponse.credential) {
              onSuccess(credentialResponse.credential);
            } else {
              onError?.();
            }
          }}
          onError={() => onError?.()}
          text="continue_with"
        />
      </div>
    </GoogleOAuthProvider>
  );
}
