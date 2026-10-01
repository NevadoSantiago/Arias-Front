import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AdminLayout } from './AdminLayout';
import { useAuthStore } from '@/features/auth/store/authStore';

vi.mock('@/features/auth/hooks/useAuthActions', () => ({
  useAuthActions: () => ({ performLogout: vi.fn() }),
}));

function renderLayout(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AdminLayout />
    </MemoryRouter>,
  );
}

const nav = () => screen.getByRole('navigation', { name: 'Navegación del panel' });

describe('AdminLayout navigation', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null });
  });

  it('renders the top-level entries and both group toggles', () => {
    renderLayout('/admin/dashboard');
    const n = within(nav());
    expect(n.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/admin/dashboard');
    expect(n.getByRole('link', { name: 'Configuración' })).toHaveAttribute('href', '/admin/config');
    expect(n.getByRole('button', { name: 'Administración platos' })).toBeInTheDocument();
    expect(n.getByRole('button', { name: 'Empresas' })).toBeInTheDocument();
  });

  it('keeps groups collapsed when the current page is not inside them', () => {
    renderLayout('/admin/dashboard');
    const n = within(nav());
    expect(n.getByRole('button', { name: 'Administración platos' })).toHaveAttribute('aria-expanded', 'false');
    expect(n.queryByRole('link', { name: 'Platos' })).not.toBeInTheDocument();
  });

  it('opens the group that contains the current page and marks the item as current', () => {
    renderLayout('/admin/dishes');
    const n = within(nav());
    expect(n.getByRole('button', { name: 'Administración platos' })).toHaveAttribute('aria-expanded', 'true');
    expect(n.getByRole('link', { name: 'Platos' })).toHaveAttribute('aria-current', 'page');
    expect(n.getByRole('link', { name: 'Calendario' })).not.toHaveAttribute('aria-current');
    expect(n.getByRole('button', { name: 'Empresas' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('lists the dish administration children in order with the renamed packs entry', () => {
    renderLayout('/admin/dashboard');
    fireEvent.click(within(nav()).getByRole('button', { name: 'Administración platos' }));
    const items = within(nav()).getAllByRole('link').map((a) => [a.textContent, a.getAttribute('href')]);
    expect(items).toEqual([
      ['Dashboard', '/admin/dashboard'],
      ['Ver menú', '/admin/menu'],
      ['Platos', '/admin/dishes'],
      ['Calendario', '/admin/dish-calendar'],
      ['Paquetes', '/admin/credit-packs'],
      ['Categorías', '/admin/categories'],
      ['Acompañamientos', '/admin/sides'],
      ['Secciones del menú', '/admin/sections'],
      ['Configuración', '/admin/config'],
    ]);
  });

  it('toggles a group open and closed', () => {
    renderLayout('/admin/dashboard');
    const toggle = within(nav()).getByRole('button', { name: 'Empresas' });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const n = within(nav());
    expect(n.getByRole('link', { name: 'Dashboard empresa' })).toHaveAttribute('href', '/admin/companies/dashboard');
    expect(n.getByRole('link', { name: 'Facturación' })).toHaveAttribute('href', '/admin/billing');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(n.queryByRole('link', { name: 'Facturación' })).not.toBeInTheDocument();
  });

  it('only marks the exact company item as current', () => {
    renderLayout('/admin/companies/dashboard');
    const n = within(nav());
    expect(n.getByRole('link', { name: 'Dashboard empresa' })).toHaveAttribute('aria-current', 'page');
    expect(n.getByRole('link', { name: 'Empresas' })).not.toHaveAttribute('aria-current');
  });

  it('highlights the group label containing the current page', () => {
    renderLayout('/admin/billing');
    const n = within(nav());
    expect(n.getByRole('button', { name: 'Empresas' })).toHaveAttribute('data-active', 'true');
    expect(n.getByRole('button', { name: 'Administración platos' })).not.toHaveAttribute('data-active');
  });
});
