import { Navigate } from 'react-router-dom';
import { useIsAuthenticated } from '../store/authStore';

/**
 * Wrapper para rutas que SOLO deben verse sin sesión (ej: /login).
 * Si el usuario ya está logueado → directo a /orders/today.
 */
export function PublicRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useIsAuthenticated();

  if (isAuthenticated) {
    return <Navigate to="/orders/today" replace />;
  }

  return <>{children}</>;
}
