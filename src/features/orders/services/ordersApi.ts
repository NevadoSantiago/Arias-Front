import { api } from '@/lib/api';
import type { DailyChoice, Dish, MenuSection, OrderEstado, RestaurantConfig } from '../types';

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

// ─── Pedido nuevo por créditos (carrito multi-ítem, retiro programado) ──
//
// Bajo /api/v2, convive con el camino viejo de arriba (DailyChoice) mientras
// el frontend migra — ver `OrderPlacementController` (backend). Mismos roles
// que el camino viejo: los clientes B2C autorregistrados también reciben
// Role.EMPLOYEE (company = NULL), así que no hace falta distinguir por rol
// acá tampoco.

const BASE_V2 = '/api/v2/orders';

export interface OrderItemV2Payload {
  dishId: number;
  sideId: number | null;
  notas: string | null;
}

export interface PlaceOrderV2Payload {
  items: OrderItemV2Payload[];
  /** ISO-8601 instant — uno de los horarios que devolvió {@link getPickupSlots}, nunca generado en el cliente. */
  pickupAt: string;
  notas: string | null;
}

export interface OrderItemV2 {
  id: number;
  dishId: number;
  dishNombre: string;
  dishCategoria: string;
  sideId: number | null;
  sideNombre: string | null;
  /** Costo en créditos ("almuerzos") de este ítem, tal como lo calculó el backend. */
  creditCost: number;
  notas: string | null;
}

export interface OrderV2 {
  id: number;
  fecha: string;
  pickupAt: string;
  estado: OrderEstado;
  /** Suma del `creditCost` de cada ítem — el total del pedido, en "almuerzos". */
  creditTotal: number;
  notas: string | null;
  items: OrderItemV2[];
  /**
   * `true` si el backend todavía admite cancelar este pedido (`now < pickupAt -
   * pickup_lead_minutes`, antelación configurable por el admin) — el frontend
   * NUNCA recalcula esta ventana, siempre confía en el valor del backend.
   */
  cancellable: boolean;
}

/** Saldo de almuerzos insuficiente para confirmar el pedido — nunca se calcula en el cliente, viene del backend. */
export class InsufficientCreditsError extends Error {
  constructor() {
    super('No te alcanzan los almuerzos disponibles para este pedido.');
    this.name = 'InsufficientCreditsError';
  }
}

/**
 * Horarios de retiro válidos para `fecha` — únicamente los que ofrece el
 * backend (ventana de servicio, antelación, semana actual/siguiente,
 * fechas deshabilitadas). El frontend nunca genera horarios por su cuenta.
 */
export async function getPickupSlots(fecha: string): Promise<string[]> {
  const { data } = await api.get<string[]>(`${BASE}/pickup-slots`, { params: { fecha } });
  return data;
}

/** Confirma el carrito contra el pedido nuevo por créditos (múltiples ítems, horario de retiro explícito). */
export async function placeOrderV2(payload: PlaceOrderV2Payload): Promise<OrderV2> {
  try {
    const { data } = await api.post<OrderV2>(BASE_V2, payload);
    return data;
  } catch (err) {
    throw mapOrderV2Error(err);
  }
}

/** Cancela un pedido del camino nuevo — el backend libera crédito y stock. */
export async function cancelOrderV2(orderId: number): Promise<void> {
  await api.delete(`${BASE_V2}/${orderId}`);
}

/**
 * Pedidos del usuario autenticado — últimos 30, con retiro más próximo
 * primero, incluye pedidos cancelados. Scope por el usuario del JWT en el
 * backend, nunca por un parámetro que el cliente pudiera manipular.
 */
export async function getOrdersV2(): Promise<OrderV2[]> {
  const { data } = await api.get<OrderV2[]>(BASE_V2);
  return data;
}

function mapOrderV2Error(err: unknown): Error {
  if (typeof err === 'object' && err !== null && 'response' in err) {
    const data = (err as { response?: { data?: { title?: string } } }).response?.data;
    if (data?.title === 'insufficient-credits') {
      return new InsufficientCreditsError();
    }
  }
  return err instanceof Error ? err : new Error('Error de red');
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
