import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AuthLayout } from '@/layouts/AuthLayout';
import { AppLayout } from '@/layouts/AppLayout';
import { AdminLayout } from '@/layouts/AdminLayout';
import { LoginPage } from '@/pages/LoginPage';
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage';
import { ResetPasswordPage } from '@/pages/ResetPasswordPage';
import { UnsubscribeReminderPage } from '@/pages/UnsubscribeReminderPage';
import { TodayOrderPage } from '@/pages/employee/TodayOrderPage';
import { OrderSummaryPage } from '@/pages/employee/OrderSummaryPage';
import { AdminDashboardPage } from '@/pages/admin/AdminDashboardPage';
import { AdminConfigPage } from '@/pages/admin/AdminConfigPage';
import { AdminCompaniesPage } from '@/pages/admin/AdminCompaniesPage';
import { AdminSectionsPage } from '@/pages/admin/AdminSectionsPage';
import { AdminCategoriesPage } from '@/pages/admin/AdminCategoriesPage';
import { AdminSidesPage } from '@/pages/admin/AdminSidesPage';
import { AdminDishesPage } from '@/pages/admin/AdminDishesPage';
import { AdminDishCalendarPage } from '@/pages/admin/AdminDishCalendarPage';
import { AdminMenuPreviewPage } from '@/pages/admin/AdminMenuPreviewPage';
import { CompanyAdminLayout } from '@/layouts/CompanyAdminLayout';
import { CompanyAdminEmployeesPage } from '@/pages/companyAdmin/CompanyAdminEmployeesPage';
import { CompanyAdminMetricsPage } from '@/pages/companyAdmin/CompanyAdminMetricsPage';
import { ProtectedRoute } from '@/features/auth/components/ProtectedRoute';
import { PublicRoute } from '@/features/auth/components/PublicRoute';
import { LandingRoute } from '@/features/landing/components/LandingRoute';

export const router = createBrowserRouter([
  // ─── Rutas públicas (no requieren sesión) ─────────────────────────────
  {
    element: (
      <PublicRoute>
        <AuthLayout />
      </PublicRoute>
    ),
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/forgot-password', element: <ForgotPasswordPage /> },
      { path: '/reset-password', element: <ResetPasswordPage /> },
    ],
  },

  // ─── Rutas de empleado ────────────────────────────────────────────────
  {
    element: (
      <ProtectedRoute roles={['EMPLOYEE']}>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      { path: '/orders/today', element: <TodayOrderPage /> },
      { path: '/orders/today/summary', element: <OrderSummaryPage /> },
    ],
  },

  // ─── Rutas de admin del restaurant ─────────────────────────────────────
  {
    element: (
      <ProtectedRoute roles={['SUPER_ADMIN']}>
        <AdminLayout />
      </ProtectedRoute>
    ),
    children: [
      { path: '/admin', element: <Navigate to="/admin/dashboard" replace /> },
      { path: '/admin/dashboard', element: <AdminDashboardPage /> },
      { path: '/admin/menu', element: <AdminMenuPreviewPage /> },
      { path: '/admin/dishes', element: <AdminDishesPage /> },
      { path: '/admin/dish-calendar', element: <AdminDishCalendarPage /> },
      { path: '/admin/companies', element: <AdminCompaniesPage /> },
      { path: '/admin/sections', element: <AdminSectionsPage /> },
      { path: '/admin/categories', element: <AdminCategoriesPage /> },
      { path: '/admin/sides', element: <AdminSidesPage /> },
      { path: '/admin/config', element: <AdminConfigPage /> },
    ],
  },

  // ─── Rutas de CompanyAdmin (admin de empresa cliente) ──────────────────
  {
    element: (
      <ProtectedRoute roles={['COMPANY_ADMIN']}>
        <CompanyAdminLayout />
      </ProtectedRoute>
    ),
    children: [
      { path: '/company-admin', element: <Navigate to="/company-admin/today" replace /> },
      { path: '/company-admin/employees', element: <CompanyAdminEmployeesPage /> },
      { path: '/company-admin/metrics', element: <CompanyAdminMetricsPage /> },
      // El admin de la empresa también almuerza ahí — reusa las páginas de empleado
      { path: '/company-admin/today', element: <TodayOrderPage /> },
      { path: '/company-admin/today/summary', element: <OrderSummaryPage /> },
    ],
  },

  // Página pública del link "no quiero más recordatorios" del mail
  { path: '/unsubscribe-reminder', element: <UnsubscribeReminderPage /> },

  // Raíz pública: landing de marketing (con sesión → home del rol vía LandingRoute)
  { path: '/', element: <LandingRoute /> },
  { path: '*', element: <Navigate to="/" replace /> },
]);
