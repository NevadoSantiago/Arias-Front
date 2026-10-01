import { describe, expect, it } from 'vitest';
import { isValidElement } from 'react';
import { Navigate, type RouteObject } from 'react-router-dom';
import { router } from './routes';
import { AdminOrdersByPickupPage } from '@/pages/admin/AdminOrdersByPickupPage';
import { AdminDashboardPage } from '@/pages/admin/AdminDashboardPage';

function flatten(routes: RouteObject[]): RouteObject[] {
  return routes.flatMap((r) => [r, ...flatten(r.children ?? [])]);
}
const find = (path: string) => flatten(router.routes).find((r) => r.path === path);

describe('admin routes', () => {
  it('renders the orders board as the dashboard', () => {
    const el = find('/admin/dashboard')?.element;
    expect(isValidElement(el) && el.type).toBe(AdminOrdersByPickupPage);
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
