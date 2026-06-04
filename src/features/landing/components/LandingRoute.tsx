import { Navigate } from 'react-router-dom';
import { useAuthStore, useIsAuthenticated } from '@/features/auth/store/authStore';
import { homeForRole } from '@/features/auth/components/ProtectedRoute';
import { LandingPage } from '@/pages/LandingPage';

/**
 * Ruta raíz "/": muestra la landing pública a las visitas, pero si el
 * usuario ya tiene sesión lo manda directo al home de su rol (no tiene
 * sentido mostrarle marketing a alguien que ya es cliente).
 */
export function LandingRoute() {
  const isAuthenticated = useIsAuthenticated();
  const user = useAuthStore((s) => s.user);

  if (isAuthenticated && user) {
    return <Navigate to={homeForRole(user.role)} replace />;
  }

  return <LandingPage />;
}
