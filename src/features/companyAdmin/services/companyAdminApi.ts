import { api } from '@/lib/api';

const BASE = '/api/v1/company-admin';

export interface Employee {
  id: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  categoryId: number | null;
  categoryNombre: string | null;
  active: boolean;
  firstLoginPending: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  role: 'EMPLOYEE' | 'COMPANY_ADMIN';
}

export interface CreateEmployeePayload {
  email: string;
}

export interface Category {
  id: number;
  nombre: string;
  parentId: number | null;
}

export interface BulkCreateResult {
  created: Employee[];
  skipped: { email: string; reason: string }[];
}

export async function listEmployees(): Promise<Employee[]> {
  const { data } = await api.get<Employee[]>(`${BASE}/employees`);
  return data;
}

export async function createEmployee(payload: CreateEmployeePayload): Promise<Employee> {
  const { data } = await api.post<Employee>(`${BASE}/employees`, payload);
  return data;
}

export async function bulkCreateEmployees(emails: string[]): Promise<BulkCreateResult> {
  const { data } = await api.post<BulkCreateResult>(`${BASE}/employees/bulk`, { emails });
  return data;
}

export async function updateEmployeeCategory(id: number, categoryId: number): Promise<Employee> {
  const { data } = await api.put<Employee>(`${BASE}/employees/${id}/category`, { categoryId });
  return data;
}

export async function disableEmployee(id: number): Promise<void> {
  await api.delete(`${BASE}/employees/${id}`);
}

export async function enableEmployee(id: number): Promise<void> {
  await api.put(`${BASE}/employees/${id}/enable`);
}

/** Soft delete — el empleado deja de aparecer en la lista. Solo funciona si ya está inactivo. */
export async function archiveEmployee(id: number): Promise<void> {
  await api.delete(`${BASE}/employees/${id}/archive`);
}

export async function listCategories(): Promise<Category[]> {
  const { data } = await api.get<Category[]>('/api/v1/categories');
  return data;
}

// ── Metrics ──────────────────────────────────────────────────────

export interface DailyOrderCount {
  fecha: string;
  count: number;
}

export interface CategoryOrderCount {
  categoryId: number;
  categoryName: string;
  count: number;
}

export interface ParticipationMetrics {
  activeEmployees: number;
  orderedToday: number;
  todayRate: number;
  weekOrders: number;
  weekRate: number;
}

const METRICS_BASE = `${BASE}/metrics`;

export async function getDailyOrders(): Promise<DailyOrderCount[]> {
  const { data } = await api.get<DailyOrderCount[]>(`${METRICS_BASE}/daily-orders`);
  return data;
}

export async function getOrdersByCategory(): Promise<CategoryOrderCount[]> {
  const { data } = await api.get<CategoryOrderCount[]>(`${METRICS_BASE}/orders-by-category`);
  return data;
}

export async function getParticipation(): Promise<ParticipationMetrics> {
  const { data } = await api.get<ParticipationMetrics>(`${METRICS_BASE}/participation`);
  return data;
}
