import { api } from '@/lib/api';
import type { DailyChoice, Dish, MenuSection, RestaurantConfig } from '../types';

// ─── Endpoints reales del backend ──────────────────────────────────────

const BASE = '/api/v1';

export async function getRestaurantConfig(): Promise<RestaurantConfig> {
  const { data } = await api.get<{ horaCorte: string; timezone: string }>(
    `${BASE}/restaurant-config`
  );
  return { horaCorte: data.horaCorte.substring(0, 5) };
}

export async function getMenuSections(): Promise<MenuSection[]> {
  const { data } = await api.get<MenuSection[]>(`${BASE}/menu-sections`);
  return data;
}

export async function getAvailableDishes(fecha?: string): Promise<Dish[]> {
  const params = fecha ? { fecha } : {};
  const { data } = await api.get<Dish[]>(`${BASE}/dishes/available`, { params });
  return data;
}

export async function getTodayOrder(): Promise<DailyChoice | null> {
  const response = await api.get<DailyChoice>(`${BASE}/orders/today`, {
    validateStatus: (s) => s === 200 || s === 204,
  });
  if (response.status === 204) return null;
  return normalizeOrder(response.data);
}

export async function getWeekOrders(): Promise<DailyChoice[]> {
  const { data } = await api.get<DailyChoice[]>(`${BASE}/orders/week`);
  return data.map(normalizeOrder);
}

export interface PlaceOrderPayload {
  dishId: number;
  sideId: number | null;
  notas: string | null;
  fecha?: string;
}

export async function placeOrder(payload: PlaceOrderPayload): Promise<DailyChoice> {
  const { data } = await api.post<DailyChoice>(`${BASE}/orders`, payload);
  return normalizeOrder(data);
}

export async function updateOrder(orderId: number, payload: PlaceOrderPayload): Promise<DailyChoice> {
  const { data } = await api.put<DailyChoice>(`${BASE}/orders/${orderId}`, payload);
  return normalizeOrder(data);
}

export async function cancelOrder(fecha?: string): Promise<void> {
  const params = fecha ? { fecha } : {};
  await api.delete(`${BASE}/orders/today`, { params });
}

export interface DishPreference {
  sideId: number | null;
  sideNombre: string | null;
  notas: string | null;
}

export async function getDishPreference(dishId: number): Promise<DishPreference | null> {
  const response = await api.get<DishPreference>(`${BASE}/orders/preferences/${dishId}`, {
    validateStatus: (s) => s === 200 || s === 204,
  });
  return response.status === 204 ? null : response.data;
}

/**
 * Sugerencia para pre-cargar el modal "El último [día] pediste:" — devuelve
 * el último pedido del mismo día de la semana, o null si no hay historial.
 */
export async function getOrderSuggestion(): Promise<DailyChoice | null> {
  const response = await api.get<DailyChoice>(`${BASE}/orders/suggestion`, {
    validateStatus: (s) => s === 200 || s === 204,
  });
  if (response.status === 204) return null;
  return normalizeOrder(response.data);
}

// ─── Fechas deshabilitadas ────────────────────────────────────────────

export interface DisabledDate {
  fecha: string;
  motivo: string | null;
}

export async function getDisabledDates(from?: string, to?: string): Promise<DisabledDate[]> {
  const params: Record<string, string> = {};
  if (from) params.from = from;
  if (to) params.to = to;
  const { data } = await api.get<DisabledDate[]>(`${BASE}/restaurant-config/disabled-dates`, { params });
  return data;
}

// ─── Helpers ──────────────────────────────────────────────────────────

/**
 * El backend devuelve {@code horaEntrega} como "HH:MM:SS". El frontend espera
 * "HH:MM". Lo recortamos para mantener la API del componente sin cambios.
 */
function normalizeOrder(raw: DailyChoice): DailyChoice {
  return {
    ...raw,
    horaEntrega: raw.horaEntrega?.substring(0, 5) ?? raw.horaEntrega,
  };
}
