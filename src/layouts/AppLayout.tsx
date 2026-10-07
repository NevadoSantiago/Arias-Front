import { Link, NavLink, Outlet } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/features/auth/store/authStore';
import { useAuthActions } from '@/features/auth/hooks/useAuthActions';
import { NotificationsBell } from '@/features/me/components/NotificationsBell';
import { BalanceChip } from '@/features/credits/components/BalanceChip';

export function AppLayout() {
  const user = useAuthStore((s) => s.user);
  const { performLogout } = useAuthActions();

  return (
    <div className="min-h-full flex flex-col bg-background">
      <header className="border-b border-border bg-card">
        <div className="container flex items-center justify-between h-16">
          {/* Logo / brand */}
          <Link to="/orders/today" data-tour="logo" className="flex items-baseline gap-3">
            <h1 className="font-display text-primary text-2xl font-bold leading-none">
              ARIAS
            </h1>
            <p className="hidden sm:block font-sans text-primary text-[10px] tracking-brand uppercase font-medium">
              Bodegón &middot; Parrilla
            </p>
          </Link>

          {/* Navegación B2C — "Pedir" y "Mis pedidos", con subrayado rojo en la
              actual. Solo para clientes B2C (sin empresa); los empleados de
              empresa siguen usando únicamente su pantalla de pedido del día
              (`CompanyOrderPage`, camino v1, sin cambios). */}
          {user && user.companyId == null && (
            <nav aria-label="Principal" className="hidden sm:flex items-stretch gap-8 self-stretch">
              {[
                { to: '/orders/today', label: 'Pedir' },
                { to: '/orders/mine', label: 'Mis pedidos' },
              ].map(({ to, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `flex items-center border-b-2 pt-0.5 text-sm font-semibold transition-colors ${
                      isActive
                        ? 'border-primary-deep text-foreground'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`
                  }
                >
                  {label}
                </NavLink>
              ))}
            </nav>
          )}

          {/* User info + logout */}
          <div className="flex items-center gap-4">
            {user && user.companyId == null && <BalanceChip />}
            {user && (
              <div className="hidden sm:block text-right leading-tight">
                <p className="font-sans text-sm text-foreground font-medium">
                  {user.firstName} {user.lastName}
                </p>
                {user.companyName && (
                  <p className="text-[11px] text-muted-foreground uppercase tracking-brand">
                    {user.companyName}
                  </p>
                )}
              </div>
            )}
            <NotificationsBell />
            <Button
              variant="ghost"
              size="icon"
              aria-label="Cerrar sesión"
              onClick={() => void performLogout()}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
