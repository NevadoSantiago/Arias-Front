import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LogOut, LayoutDashboard, Wallet, UtensilsCrossed, Building2, Settings, ChevronDown, Menu, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/features/auth/store/authStore';
import { useAuthActions } from '@/features/auth/hooks/useAuthActions';

interface NavLeaf {
  to: string;
  label: string;
}

interface NavLinkEntry extends NavLeaf {
  type: 'link';
  icon: React.ComponentType<{ className?: string }>;
}

interface NavGroupEntry {
  type: 'group';
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  children: NavLeaf[];
}

type NavEntry = NavLinkEntry | NavGroupEntry;

const NAV: NavEntry[] = [
  { type: 'link', to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { type: 'link', to: '/admin/payments', label: 'Pagos', icon: Wallet },
  {
    type: 'group',
    id: 'dishes',
    label: 'Administración platos',
    icon: UtensilsCrossed,
    children: [
      { to: '/admin/menu', label: 'Ver menú' },
      { to: '/admin/dishes', label: 'Platos' },
      { to: '/admin/dish-calendar', label: 'Calendario' },
      { to: '/admin/credit-packs', label: 'Paquetes' },
      { to: '/admin/categories', label: 'Categorías' },
      { to: '/admin/sides', label: 'Acompañamientos' },
      { to: '/admin/sections', label: 'Secciones del menú' },
    ],
  },
  {
    type: 'group',
    id: 'companies',
    label: 'Empresas',
    icon: Building2,
    children: [
      { to: '/admin/companies/dashboard', label: 'Dashboard empresa' },
      { to: '/admin/companies', label: 'Empresas' },
      { to: '/admin/billing', label: 'Facturación' },
    ],
  },
  { type: 'link', to: '/admin/config', label: 'Configuración', icon: Settings },
];

const ITEM_BASE =
  'flex items-center gap-2.5 px-3 py-2 rounded-md text-xs uppercase tracking-brand font-medium transition-colors';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    ITEM_BASE,
    isActive
      ? 'bg-primary-deep text-primary-foreground'
      : 'text-foreground hover:bg-muted hover:text-primary'
  );

function groupHasPath(group: NavGroupEntry, pathname: string) {
  return group.children.some((c) => c.to === pathname);
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { pathname } = useLocation();
  // `open` guarda solo overrides explícitos; sin override, un grupo está abierto
  // únicamente si contiene la página actual.
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    const current = NAV.find(
      (e): e is NavGroupEntry => e.type === 'group' && groupHasPath(e, pathname)
    );
    if (current) setOpen((o) => ({ ...o, [current.id]: true }));
  }

  return (
    <nav aria-label="Navegación del panel" className="p-4 lg:p-6">
      <ul className="flex flex-col gap-1">
        {NAV.map((entry) => {
          const Icon = entry.icon;
          if (entry.type === 'link') {
            return (
              <li key={entry.to}>
                <NavLink to={entry.to} end onClick={onNavigate} className={linkClass}>
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{entry.label}</span>
                </NavLink>
              </li>
            );
          }

          const active = groupHasPath(entry, pathname);
          const expanded = open[entry.id] ?? active;
          const panelId = `admin-nav-${entry.id}`;
          return (
            <li key={entry.id}>
              <button
                type="button"
                aria-expanded={expanded}
                aria-controls={panelId}
                data-active={active ? 'true' : undefined}
                onClick={() => setOpen((o) => ({ ...o, [entry.id]: !expanded }))}
                className={cn(
                  ITEM_BASE,
                  'w-full text-left hover:bg-muted',
                  active ? 'text-primary' : 'text-foreground hover:text-primary'
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="flex-1">{entry.label}</span>
                <ChevronDown
                  aria-hidden="true"
                  className={cn('w-4 h-4 shrink-0 transition-transform', expanded && 'rotate-180')}
                />
              </button>
              {expanded && (
                <ul id={panelId} className="mt-1 ml-4 pl-2 border-l border-border flex flex-col gap-1">
                  {entry.children.map((child) => (
                    <li key={child.to}>
                      <NavLink to={child.to} end onClick={onNavigate} className={linkClass}>
                        {child.label}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function AdminLayout() {
  const user = useAuthStore((s) => s.user);
  const { performLogout } = useAuthActions();
  const [mobileOpen, setMobileOpen] = useState(false);

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
        {/* Sidebar — en mobile se despliega desde el botón "Menú" */}
        <aside className="lg:w-64 lg:shrink-0 border-b lg:border-b-0 lg:border-r border-border bg-card/40">
          <button
            type="button"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((v) => !v)}
            className="lg:hidden flex w-full items-center gap-2 px-6 py-3 text-xs uppercase tracking-brand font-medium"
          >
            {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            Menú
          </button>
          <div className={cn(!mobileOpen && 'hidden', 'lg:block')}>
            <SidebarNav onNavigate={() => setMobileOpen(false)} />
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
