import { Outlet } from 'react-router-dom';

/**
 * Layout para pantallas no autenticadas (login, first-login).
 * Es full-bleed: las pantallas hijas controlan su propio layout interno
 * (ej: el Login usa un split-screen ilustración + form).
 */
export function AuthLayout() {
  return (
    <main className="min-h-full bg-background">
      <Outlet />
    </main>
  );
}
