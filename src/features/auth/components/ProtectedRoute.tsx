import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore, useIsAuthenticated, type Role } from '../store/authStore';

interface Props {
  children: React.ReactNode;
  /** Si se pasa, el usuario tiene que tener uno de estos roles para entrar */
  roles?: Role[];
}

/**
 * Wrapper para rutas que requieren sesión activa.
 * Si no hay sesión → /login.
 * Si el usuario está logueado pero su rol no está en {@code roles} → home según rol.
 */
export function ProtectedRoute({ children, roles }: Props) {
  const isAuthenticated = useIsAuthenticated();
  const user = useAuthStore((s) => s.user);
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (roles && user && !roles.includes(user.role)) {
    // Redirigir al home según el rol del usuario logueado
    return <Navigate to={homeForRole(user.role)} replace />;
  }

  return <>{children}</>;
}

/** Home por defecto según el rol — usado al loguear y al rebotar por permisos. */
export function homeForRole(role: Role): string {
  switch (role) {
    case 'SUPER_ADMIN':
      return '/admin/dashboard';
    case 'COMPANY_ADMIN':
      return '/company-admin/employees';
    case 'EMPLOYEE':
      return '/orders/today';
  }
}
