import type { Role } from '@/features/auth/store/authStore';

/**
 * Devuelve los paths del flow del pedido según el rol del usuario.
 * EMPLOYEE usa /orders/today/* (vive en AppLayout).
 * COMPANY_ADMIN usa /company-admin/today/* (vive en CompanyAdminLayout).
 *
 * Las páginas TodayOrderPage y OrderSummaryPage se reusan en ambos paths —
 * la única diferencia es la URL + el layout que las envuelve.
 */
export function orderFlowPaths(role: Role | undefined): { today: string; summary: string } {
  const isCompanyAdmin = role === 'COMPANY_ADMIN';
  return {
    today: isCompanyAdmin ? '/company-admin/today' : '/orders/today',
    summary: isCompanyAdmin ? '/company-admin/today/summary' : '/orders/today/summary',
  };
}
