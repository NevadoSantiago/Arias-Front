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

export async function markOrderDelivered(orderId: number): Promise<void> {
  await api.put(`${BASE}/orders/${orderId}/deliver`);
}

export async function markCompanyOrdersDelivered(companyId: number): Promise<void> {
  await api.put(`${BASE}/orders/deliver-company/${companyId}`);
}

export async function exportOrders(fecha: string): Promise<void> {
  const response = await api.get(`${BASE}/orders/export`, {
    params: { fecha },
    responseType: 'blob',
  });

  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `pedidos-${fecha}.xlsx`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export async function markOrderComandado(orderId: number): Promise<void> {
  await api.put(`${BASE}/orders/${orderId}/comandar`);
}

export async function markCompanyOrdersComandado(companyId: number): Promise<void> {
  await api.put(`${BASE}/orders/comandar-company/${companyId}`);
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

// ─── Categorías (para dropdowns del admin) ────────────────────────────

export interface AdminCategory {
  id: number;
  nombre: string;
  parentId: number | null;
}

export async function listCategories(): Promise<AdminCategory[]> {
  const { data } = await api.get<AdminCategory[]>('/api/v1/categories');
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
  diasSemana: string[];
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
  diasSemana: string[];
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
