import { describe, expect, it } from 'vitest';
import { isValidElement } from 'react';
import { Navigate, type RouteObject } from 'react-router-dom';
import { router } from './routes';
import { TourRoot } from '@/features/tour/TourRoot';
import { AdminOrdersByPickupPage } from '@/pages/admin/AdminOrdersByPickupPage';
import { AdminPaymentsPage } from '@/pages/admin/AdminPaymentsPage';
import { AdminDashboardPage } from '@/pages/admin/AdminDashboardPage';
import { AdminPrintersPage } from '@/pages/admin/AdminPrintersPage';

function flatten(routes: RouteObject[]): RouteObject[] {
  return routes.flatMap((r) => [r, ...flatten(r.children ?? [])]);
}
const find = (path: string) => flatten(router.routes).find((r) => r.path === path);

describe('admin routes', () => {
  it('renders the printers page at /admin/printers', () => {
    const el = find('/admin/printers')?.element;
    expect(isValidElement(el) && el.type).toBe(AdminPrintersPage);
  });

  it('renders the orders board as the dashboard', () => {
    const el = find('/admin/dashboard')?.element;
    expect(isValidElement(el) && el.type).toBe(AdminOrdersByPickupPage);
  });

  it('renders the payments report at /admin/payments', () => {
    const el = find('/admin/payments')?.element;
    expect(isValidElement(el) && el.type).toBe(AdminPaymentsPage);
  });

  it('moves the company dashboard to /admin/companies/dashboard', () => {
    const el = find('/admin/companies/dashboard')?.element;
    expect(isValidElement(el) && el.type).toBe(AdminDashboardPage);
  });

  it('redirects the old orders-by-pickup path to the dashboard', () => {
    const el = find('/admin/orders-by-pickup')?.element;
    expect(isValidElement(el) && el.type).toBe(Navigate);
    expect(isValidElement(el) && (el.props as { to: string; replace?: boolean })).toMatchObject({
      to: '/admin/dashboard',
      replace: true,
    });
  });
});

describe('credits routes', () => {
  it('redirects the old packs page to the purchase sheet on "Mis almuerzos"', () => {
    const el = find('/credits/packs')?.element;
    expect(isValidElement(el) && el.type).toBe(Navigate);
    expect(isValidElement(el) && (el.props as { to: string; replace?: boolean })).toMatchObject({
      to: '/credits?comprar=1',
      replace: true,
    });
  });
});

describe('onboarding tour', () => {
  it('mounts the tour provider above every route, so it survives navigation between screens', () => {
    const root = router.routes.find((r) => r.path === undefined && !!r.children?.length && r.children.some((c) => c.path === '/' || c.path === '*'));
    // Un único layout raíz sin path envuelve a todas las rutas (incluye /orders/today y /credits).
    expect(router.routes).toHaveLength(1);
    expect(isValidElement(root?.element) && root?.element.type).toBe(TourRoot);
    const paths = flatten(root?.children ?? []).map((r) => r.path);
    expect(paths).toContain('/orders/today');
    expect(paths).toContain('/credits');
  });
});
