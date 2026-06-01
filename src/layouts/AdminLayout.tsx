import { Link, NavLink, Outlet } from 'react-router-dom';
import { LogOut, LayoutDashboard, UtensilsCrossed, Building2, ListOrdered, Salad, Settings, Eye, CalendarDays, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/features/auth/store/authStore';
import { useAuthActions } from '@/features/auth/hooks/useAuthActions';

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/admin/dashboard',     label: 'Dashboard',             icon: LayoutDashboard },
  { to: '/admin/menu',          label: 'Ver menú',              icon: Eye },
  { to: '/admin/dishes',        label: 'Platos',                icon: UtensilsCrossed },
  { to: '/admin/dish-calendar', label: 'Calendario',              icon: CalendarDays },
  { to: '/admin/companies',     label: 'Empresas',              icon: Building2 },
  { to: '/admin/sections',      label: 'Secciones del menú',    icon: ListOrdered },
  { to: '/admin/categories',    label: 'Categorías',            icon: Layers },
  { to: '/admin/sides',         label: 'Acompañamientos',       icon: Salad },
  { to: '/admin/config',        label: 'Configuración',         icon: Settings },
];

export function AdminLayout() {
  const user = useAuthStore((s) => s.user);
  const { performLogout } = useAuthActions();

  return (
    <div className="min-h-full flex flex-col bg-background">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="border-b border-border bg-card">
        <div className="flex items-center justify-between h-16 px-6">
          <Link to="/admin/dashboard" className="flex items-baseline gap-3">
            <h1 className="font-display text-primary text-2xl font-bold leading-none">
              ARIAS
            </h1>
            <p className="hidden sm:block font-sans text-primary text-[10px] tracking-brand uppercase font-medium">
              Panel Administrativo
            </p>
          </Link>

          <div className="flex items-center gap-4">
            {user && (
              <div className="hidden sm:block text-right leading-tight">
                <p className="font-sans text-sm text-foreground font-medium">
                  {user.firstName} {user.lastName}
                </p>
                <p className="text-[11px] text-muted-foreground uppercase tracking-brand">
                  Super Admin
                </p>
              </div>
            )}
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

      {/* ── Sidebar + main ──────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Sidebar */}
        <aside className="lg:w-64 lg:shrink-0 border-b lg:border-b-0 lg:border-r border-border bg-card/40">
          <nav className="p-4 lg:p-6">
            <ul className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.to} className="shrink-0">
                    {item.disabled ? (
                      <span
                        className={cn(
                          'flex items-center gap-2.5 px-3 py-2 rounded-md',
                          'text-xs uppercase tracking-brand font-medium',
                          'text-muted-foreground/50 cursor-not-allowed whitespace-nowrap'
                        )}
                        title="Próximamente"
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        <span>{item.label}</span>
                      </span>
                    ) : (
                      <NavLink
                        to={item.to}
                        className={({ isActive }) =>
                          cn(
                            'flex items-center gap-2.5 px-3 py-2 rounded-md',
                            'text-xs uppercase tracking-brand font-medium',
                            'transition-colors whitespace-nowrap',
                            isActive
                              ? 'bg-primary text-primary-foreground'
                              : 'text-foreground hover:bg-muted hover:text-primary'
                          )
                        }
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        <span>{item.label}</span>
                      </NavLink>
                    )}
                  </li>
                );
              })}
            </ul>
          </nav>
        </aside>

        {/* Main */}
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
