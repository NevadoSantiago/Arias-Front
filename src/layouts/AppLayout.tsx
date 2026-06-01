import { Link, Outlet } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/features/auth/store/authStore';
import { useAuthActions } from '@/features/auth/hooks/useAuthActions';
import { NotificationsBell } from '@/features/me/components/NotificationsBell';

export function AppLayout() {
  const user = useAuthStore((s) => s.user);
  const { performLogout } = useAuthActions();

  return (
    <div className="min-h-full flex flex-col bg-background">
      <header className="border-b border-border bg-card">
        <div className="container flex items-center justify-between h-16">
          {/* Logo / brand */}
          <Link to="/orders/today" className="flex items-baseline gap-3">
            <h1 className="font-display text-primary text-2xl font-bold leading-none">
              ARIAS
            </h1>
            <p className="hidden sm:block font-sans text-primary text-[10px] tracking-brand uppercase font-medium">
              Bodegón &middot; Parrilla
            </p>
          </Link>

          {/* User info + logout */}
          <div className="flex items-center gap-4">
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
