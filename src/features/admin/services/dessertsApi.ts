import { api } from '@/lib/api';

export interface AdminDessert {
  id: number;
  nombre: string;
  descripcion: string | null;
  fotoUrl: string | null;
  stockDiarioDefault: number;
  stockActual: number;
  enabled: boolean;
}

export interface DessertCreatePayload {
  nombre: string;
  descripcion?: string;
  fotoUrl?: string;
  stockDiarioDefault: number;
}

export interface DessertUpdatePayload extends DessertCreatePayload {
  /** Omitted on purpose from the form so an edit never overwrites today's stock. */
  stockActual?: number;
  enabled: boolean;
}

export async function listDessertsAdmin(): Promise<AdminDessert[]> {
  const { data } = await api.get<AdminDessert[]>('/api/v1/admin/desserts');
  return data;
}

export async function createDessert(payload: DessertCreatePayload): Promise<AdminDessert> {
  const { data } = await api.post<AdminDessert>('/api/v1/admin/desserts', payload);
  return data;
}

export async function updateDessert(id: number, payload: DessertUpdatePayload): Promise<AdminDessert> {
  const { data } = await api.put<AdminDessert>(`/api/v1/admin/desserts/${id}`, payload);
  return data;
}

export async function enableDessert(id: number): Promise<void> {
  await api.put(`/api/v1/admin/desserts/${id}/enable`);
}

/** Disables (soft) the dessert: it stops being offered but keeps its history. */
export async function disableDessert(id: number): Promise<void> {
  await api.delete(`/api/v1/admin/desserts/${id}`);
}
