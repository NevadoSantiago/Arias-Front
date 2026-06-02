import { api } from '@/lib/api';

const BASE = '/api/v1/admin';

/** Estructura del consolidado del día — matchea el AdminOrderDto del backend. */
export interface AdminOrder {
  id: number;
  fecha: string;
  estado: 'PENDIENTE' | 'CONFIRMADO' | 'COMANDADO' | 'ENTREGADO';

  userId: number;
  userFirstName: string | null;
  userLastName: string | null;
  userEmail: string;

  companyId: number;
  companyName: string;

  dishId: number;
  dishNombre: string;
  dishCategoria: string;
  sideNombre: string | null;
  notas: string | null;
  horaEntrega: string; // "HH:MM:SS" — la recortamos a "HH:MM" para mostrar
}

export async function getOrdersByDate(fecha?: string): Promise<AdminOrder[]> {
  const params = fecha ? { fecha } : {};
  const { data } = await api.get<AdminOrder[]>(`${BASE}/orders/today`, { params });
  return data.map((o) => ({
    ...o,
    horaEntrega: o.horaEntrega.substring(0, 5),
  }));
}

export async function markCompanyOrdersDelivered(companyId: number): Promise<void> {
  await api.put(`${BASE}/orders/deliver-company/${companyId}`);
}

/**
 * Descarga el .xlsx de pedidos confirmados de una empresa para una fecha.
 * El nombre del archivo lo arma el backend a partir del slug de la empresa.
 */
export async function exportCompanyOrders(
  companyId: number,
  companyName: string,
  fecha: string,
): Promise<void> {
  const response = await api.get(`${BASE}/orders/export/${companyId}`, {
    params: { fecha },
    responseType: 'blob',
  });

  const slug = companyName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `pedidos-${slug}-${fecha}.xlsx`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

// ─── Configuración del restaurant ──────────────────────────────────────

export interface RestaurantConfig {
  horaCorte: string; // HH:MM
  timezone: string;
}

export async function updateRestaurantConfig(horaCorte: string): Promise<RestaurantConfig> {
  const { data } = await api.put<{ horaCorte: string; timezone: string }>(
    '/api/v1/restaurant-config',
    { horaCorte }
  );
  return { ...data, horaCorte: data.horaCorte.substring(0, 5) };
}

// ─── Fechas deshabilitadas ────────────────────────────────────────────

export async function createDisabledDate(fecha: string, motivo?: string): Promise<void> {
  await api.post('/api/v1/restaurant-config/disabled-dates', { fecha, motivo });
}

export async function deleteDisabledDate(fecha: string): Promise<void> {
  await api.delete(`/api/v1/restaurant-config/disabled-dates/${fecha}`);
}

// ─── Empresas ─────────────────────────────────────────────────────────

export interface Company {
  id: number;
  nombre: string;
  cuit: string;
  calle: string;
  altura: string;
  piso: string | null;
  horaEntrega: string; // "HH:MM"
  categoriaDefaultId: number;
  categoriaDefaultNombre: string;
  enabled: boolean;
  adminEmail: string | null;
  /** Map categoryId → precio en pesos sin decimales. */
  categoryPrices: Record<number, number>;
}

interface CompanyRawFromApi extends Omit<Company, 'horaEntrega'> {
  horaEntrega: string; // "HH:MM:SS" del back
}

export interface CreateCompanyPayload {
  nombre: string;
  cuit: string;
  calle: string;
  altura: string;
  piso?: string;
  horaEntrega: string;
  categoriaDefaultId: number;
  adminEmail: string;
  /** categoryId → precio. Required: una entry por cada categoría existente. */
  categoryPrices: Record<number, number>;
}

export interface UpdateCompanyPayload {
  nombre: string;
  cuit: string;
  calle: string;
  altura: string;
  piso?: string;
  horaEntrega: string;
  categoriaDefaultId: number;
  /** Opcional. Si se manda, actualiza el email del CompanyAdmin. */
  adminEmail?: string;
  /** categoryId → precio. Required: una entry por cada categoría existente. */
  categoryPrices: Record<number, number>;
}

const normalizeCompany = (c: CompanyRawFromApi): Company => ({
  ...c,
  horaEntrega: c.horaEntrega.substring(0, 5),
});

export async function listCompanies(): Promise<Company[]> {
  const { data } = await api.get<CompanyRawFromApi[]>('/api/v1/companies');
  return data.map(normalizeCompany);
}

export async function createCompany(payload: CreateCompanyPayload): Promise<Company> {
  const { data } = await api.post<CompanyRawFromApi>('/api/v1/companies', payload);
  return normalizeCompany(data);
}

export async function updateCompany(id: number, payload: UpdateCompanyPayload): Promise<Company> {
  const { data } = await api.put<CompanyRawFromApi>(`/api/v1/companies/${id}`, payload);
  return normalizeCompany(data);
}

export async function disableCompany(id: number): Promise<void> {
  await api.delete(`/api/v1/companies/${id}`);
}

export async function enableCompany(id: number): Promise<void> {
  await api.put(`/api/v1/companies/${id}/enable`);
}

// ─── Categorías (para dropdowns) ──────────────────────────────────────

export interface AdminCategory {
  id: number;
  nombre: string;
  parentId: number | null;
}

export async function listCategories(): Promise<AdminCategory[]> {
  const { data } = await api.get<AdminCategory[]>('/api/v1/categories');
  return data;
}

// ─── Categorías (CRUD admin completo) ─────────────────────────────────

export interface AdminCategoryFull {
  id: number;
  nombre: string;
  parentId: number | null;
  parentNombre: string | null;
  ordenDisplay: number;
  enabled: boolean;
  /** Map companyId → precio en pesos sin decimales. */
  companyPrices: Record<number, number>;
}

export interface CategoryPayload {
  nombre: string;
  parentId: number | null;
  ordenDisplay: number;
  /** Solo se manda al UPDATE — el backend lo ignora en create (default true). */
  enabled?: boolean;
  /** companyId → precio. Required: una entry por cada empresa existente. */
  companyPrices: Record<number, number>;
}

export async function listCategoriesAdmin(): Promise<AdminCategoryFull[]> {
  const { data } = await api.get<AdminCategoryFull[]>('/api/v1/categories/admin');
  return data;
}

export async function createCategory(payload: CategoryPayload): Promise<AdminCategoryFull> {
  const { data } = await api.post<AdminCategoryFull>('/api/v1/categories', payload);
  return data;
}

export async function updateCategory(id: number, payload: CategoryPayload): Promise<AdminCategoryFull> {
  const { data } = await api.put<AdminCategoryFull>(`/api/v1/categories/${id}`, payload);
  return data;
}

export async function disableCategory(id: number): Promise<void> {
  await api.delete(`/api/v1/categories/${id}`);
}

export async function enableCategory(id: number): Promise<void> {
  await api.put(`/api/v1/categories/${id}/enable`);
}

export async function archiveCategory(id: number): Promise<void> {
  await api.delete(`/api/v1/categories/${id}/archive`);
}

/** Conteo de platos activos que se van a deshabilitar al archivar la categoría. */
export async function getCategoryAffectedDishesCount(id: number): Promise<number> {
  const { data } = await api.get<number>(`/api/v1/categories/${id}/affected-dishes-count`);
  return data;
}

// ─── Menu Sections ────────────────────────────────────────────────────

export interface AdminMenuSection {
  id: number;
  nombre: string;
  ordenDisplay: number;
  enabled: boolean;
}

export interface SectionPayload {
  nombre: string;
  ordenDisplay: number;
  /** Solo se manda al UPDATE (el backend ignora en create — default true). */
  enabled?: boolean;
}

export async function listMenuSectionsAdmin(): Promise<AdminMenuSection[]> {
  const { data } = await api.get<AdminMenuSection[]>('/api/v1/menu-sections/admin');
  return data;
}

export async function createMenuSection(payload: SectionPayload): Promise<AdminMenuSection> {
  const { data } = await api.post<AdminMenuSection>('/api/v1/menu-sections', payload);
  return data;
}

export async function updateMenuSection(id: number, payload: SectionPayload): Promise<AdminMenuSection> {
  const { data } = await api.put<AdminMenuSection>(`/api/v1/menu-sections/${id}`, payload);
  return data;
}

export async function disableMenuSection(id: number): Promise<void> {
  await api.delete(`/api/v1/menu-sections/${id}`);
}

export async function enableMenuSection(id: number): Promise<void> {
  await api.put(`/api/v1/menu-sections/${id}/enable`);
}

// ─── Sides (guarniciones / salsas) ────────────────────────────────────

export type SideType = 'GUARNICION' | 'SALSA';

export interface AdminSide {
  id: number;
  nombre: string;
  tipo: SideType;
  enabled: boolean;
}

export interface SidePayload {
  nombre: string;
  tipo: SideType;
  /** Solo se manda al UPDATE (el backend ignora en create — default true). */
  enabled?: boolean;
}

export async function listSidesAdmin(): Promise<AdminSide[]> {
  const { data } = await api.get<AdminSide[]>('/api/v1/sides/admin');
  return data;
}

export async function createSide(payload: SidePayload): Promise<AdminSide> {
  const { data } = await api.post<AdminSide>('/api/v1/sides', payload);
  return data;
}

export async function updateSide(id: number, payload: SidePayload): Promise<AdminSide> {
  const { data } = await api.put<AdminSide>(`/api/v1/sides/${id}`, payload);
  return data;
}

export async function disableSide(id: number): Promise<void> {
  await api.delete(`/api/v1/sides/${id}`);
}

export async function enableSide(id: number): Promise<void> {
  await api.put(`/api/v1/sides/${id}/enable`);
}

// ─── Dishes (CRUD admin completo) ─────────────────────────────────────

export interface AdminDish {
  id: number;
  nombre: string;
  descripcion: string | null;
  fotoUrl: string | null;
  category: { id: number; nombre: string; parentId: number | null };
  menuSection: { id: number; nombre: string; ordenDisplay: number };
  sideType: SideType | null;
  allowedSides: { id: number; nombre: string; tipo: SideType }[];
  stockDiarioDefault: number;
  stockActual: number;
  enabled: boolean;
  especial: boolean;
}

export interface DishPayload {
  nombre: string;
  descripcion?: string;
  fotoUrl?: string;
  categoryId: number;
  menuSectionId: number;
  sideType: SideType | null;
  allowedSideIds: number[];
  stockDiarioDefault: number;
  stockActual: number;
  /** Solo se manda al UPDATE — el backend lo ignora en create (default true). */
  enabled?: boolean;
  especial: boolean;
}

export async function listDishesAdmin(): Promise<AdminDish[]> {
  const { data } = await api.get<AdminDish[]>('/api/v1/dishes/admin');
  return data;
}

export async function createDish(payload: DishPayload): Promise<AdminDish> {
  const { data } = await api.post<AdminDish>('/api/v1/dishes', payload);
  return data;
}

export async function updateDish(id: number, payload: DishPayload): Promise<AdminDish> {
  const { data } = await api.put<AdminDish>(`/api/v1/dishes/${id}`, payload);
  return data;
}

export async function disableDish(id: number, cancelAffected = false): Promise<void> {
  await api.delete(`/api/v1/dishes/${id}`, { params: { cancelAffected } });
}

export interface AffectedOrder {
  orderId: number;
  fecha: string;
  userFirstName: string | null;
  userLastName: string | null;
  userEmail: string;
  companyName: string;
  dishNombre: string;
  sideNombre: string | null;
}

export async function getDishAffectedOrders(id: number): Promise<AffectedOrder[]> {
  const { data } = await api.get<AffectedOrder[]>(`/api/v1/dishes/${id}/affected-orders`);
  return data;
}

export async function getSideAffectedOrders(id: number): Promise<AffectedOrder[]> {
  const { data } = await api.get<AffectedOrder[]>(`/api/v1/sides/${id}/affected-orders`);
  return data;
}

export async function enableDish(id: number): Promise<void> {
  await api.put(`/api/v1/dishes/${id}/enable`);
}

export async function archiveDish(id: number): Promise<void> {
  await api.delete(`/api/v1/dishes/${id}/archive`);
}

// ─── Calendario de platos especiales ──────────────────────────────────

/**
 * Devuelve las asignaciones de especiales del rango {@code [from, to]}.
 * El back agrupa por fecha (ISO).
 */
export async function getDishCalendar(
  from: string,
  to: string,
): Promise<Record<string, number[]>> {
  const { data } = await api.get<Record<string, number[]>>(
    '/api/v1/admin/dish-calendar',
    { params: { from, to } },
  );
  return data;
}

/** Reemplaza las asignaciones de una fecha concreta. */
export async function setDishCalendarForDate(
  fecha: string,
  dishIds: number[],
): Promise<void> {
  await api.put('/api/v1/admin/dish-calendar', dishIds, { params: { fecha } });
}

/** Lista los platos especiales activos (para el picker del calendario). */
export async function getSpecialDishes(): Promise<AdminDish[]> {
  const { data } = await api.get<AdminDish[]>('/api/v1/dishes/special');
  return data;
}

// ─── Uploads (presigned URLs para R2) ─────────────────────────────────

export interface PresignedUpload {
  uploadUrl: string;
  publicUrl: string;
  key: string;
}

export async function presignDishPhotoUpload(
  fileName: string,
  contentType: string,
): Promise<PresignedUpload> {
  const { data } = await api.post<PresignedUpload>('/api/v1/admin/uploads/dish-photo', {
    fileName,
    contentType,
  });
  return data;
}
