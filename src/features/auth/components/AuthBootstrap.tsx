import { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { me, refresh } from '../services/authApi';

/**
 * Al cargar la app, intenta recuperar sesión activa usando la cookie httpOnly
 * de refresh. Si tiene éxito, popula el authStore. Si falla, sigue sin sesión
 * y el ProtectedRoute redirigirá a /login cuando corresponda.
 *
 * No renderiza nada — es un "componente invisible" que vive al lado del router.
 */
export function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const setAuth = useAuthStore((s) => s.setAuth);
  const setBootstrapping = useAuthStore((s) => s.setBootstrapping);
  const bootstrapping = useAuthStore((s) => s.bootstrapping);

  useEffect(() => {
    const recover = async () => {
      try {
        const token = await refresh();
        useAuthStore.getState().setAccessToken(token);
        const user = await me();
        setAuth(token, user);
      } catch {
        // No había sesión, o el refresh fue rechazado — no hacemos nada.
        // El usuario va a ver el login (a través del ProtectedRoute).
      } finally {
        setBootstrapping(false);
      }
    };

    void recover();
  }, [setAuth, setBootstrapping]);

  // Mientras intentamos recuperar la sesión, mostramos un loading ligero
  // para evitar el flash de "/login" en usuarios que SÍ tienen sesión activa
  if (bootstrapping) {
    return (
      <div className="min-h-full flex items-center justify-center bg-background">
        <p className="text-xs uppercase tracking-brand text-muted-foreground">
          Cargando…
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
