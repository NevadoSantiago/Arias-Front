import { api } from '@/lib/api';
import type { DailyChoice, Dish, MenuSection, OrderEstado, RestaurantConfig } from '../types';

// ─── Endpoints reales del backend ──────────────────────────────────────

const BASE = '/api/v1';

export async function getRestaurantConfig(): Promise<RestaurantConfig> {
  const { data } = await api.get<{
    horaCorte: string;
    timezone: string;
    pickupWindowStart: string | null;
    pickupWindowEnd: string | null;
    pickupSchedule?: {
      dayOfWeek: number;
      open: boolean;
      windowStart: string | null;
      windowEnd: string | null;
    }[] | null;
    pickupLeadMinutes?: number | null;
    creditExpiryDays?: number | null;
  }>(`${BASE}/restaurant-config`);
  return {
    horaCorte: data.horaCorte.substring(0, 5),
    // Tolerante a un restaurante sin ventana de retiro configurada: la
    // pantalla oculta la etiqueta de horario en vez de romper (F3.1).
    pickupWindowStart: data.pickupWindowStart ? data.pickupWindowStart.substring(0, 5) : null,
    pickupWindowEnd: data.pickupWindowEnd ? data.pickupWindowEnd.substring(0, 5) : null,
    // Tolerante a un backend viejo sin `pickupSchedule` (F14b): queda
    // `undefined` y `B2cOrderPage` cae al par global de arriba.
    pickupSchedule: data.pickupSchedule?.map((d) => ({
      dayOfWeek: d.dayOfWeek,
      open: d.open,
      windowStart: d.windowStart ? d.windowStart.substring(0, 5) : null,
      windowEnd: d.windowEnd ? d.windowEnd.substring(0, 5) : null,
    })) ?? undefined,
    // F18: usado por el aviso de corte de "Pago pendiente". Ya viajaba en
    // esta respuesta (unidad 8) pero el frontend no lo leía — tolerante a un
    // backend viejo sin el campo.
    pickupLeadMinutes: data.pickupLeadMinutes ?? undefined,
    // F22c.1: vencimiento de los almuerzos comprados; `GET /restaurant-config` es
    // para cualquier usuario autenticado, no solo admin.
    creditExpiryDays: data.creditExpiryDays ?? undefined,
  };
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
  /**
   * `true` si el backend admite AGREGAR platos a este pedido (`POST
   * /orders/{id}/items`): sólo un pedido `PENDIENTE`, antes del corte y no
   * pagado aparte con Mercado Pago. Es más estricto que `cancellable` (un
   * pedido `PENDIENTE_PAGO` es cancelable pero no modificable). El frontend
   * nunca lo recalcula (B10).
   */
  modifiable: boolean;
  /** `true` si el backend admite cambiar el horario de retiro (F19, `PATCH /orders/{id}/pickup-time`). */
  pickupTimeChangeable: boolean;
  /**
   * `true` si el pedido tiene CUALQUIER compra DIRECT de Mercado Pago —
   * también una PENDING en un pedido `PENDIENTE_PAGO` (B12). Se lee siempre
   * junto con `estado`: pagado con Mercado Pago = `paidWithMercadoPago &&
   * estado !== 'PENDIENTE_PAGO'`; a pagar = `estado === 'PENDIENTE_PAGO'`.
   */
  paidWithMercadoPago: boolean;
  /**
   * Almuerzos del saldo que este pedido ya tiene reservados (pago parcial,
   * B13/F23): en un pedido `PENDIENTE_PAGO`, lo que Mercado Pago NO cobra;
   * `creditTotal - creditsFromBalance` es la parte de Mercado Pago. `0` = todo
   * el pedido se paga (o pagó) por Mercado Pago, o se pagó solo con saldo.
   */
  creditsFromBalance: number;
}

/** Saldo de almuerzos insuficiente para confirmar el pedido — nunca se calcula en el cliente, viene del backend. */
export class InsufficientCreditsError extends Error {
  constructor() {
    super('No te alcanzan los almuerzos disponibles para este pedido.');
    this.name = 'InsufficientCreditsError';
  }
}

/**
 * El pedido dejó de ser modificable (`cancellable: false`) entre que se
 * abrió la hoja y se confirmó — el backend es siempre quien decide esa
 * ventana (`OrderPlacementService.assertModifiable`, mismo código
 * `order-not-modifiable` que la cancelación). F16.
 */
export class OrderNotModifiableError extends Error {
  constructor() {
    super('Tu pedido ya no se puede modificar; armá uno nuevo.');
    this.name = 'OrderNotModifiableError';
  }
}

/**
 * El backend rechazó el cambio de horario de retiro (F19, `PATCH
 * /orders/{id}/pickup-time`): 409 `pickup-time-locked` /
 * `pickup-day-change-not-allowed` o 400 `pickup-*`. El mensaje es el que
 * manda el backend (`detail`); si no manda ninguno, un texto genérico.
 */
export class PickupTimeChangeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PickupTimeChangeError';
  }
}

const PICKUP_TIME_ERROR_TITLES = new Set([
  'pickup-time-locked',
  'pickup-day-change-not-allowed',
  'pickup-out-of-range',
  'pickup-day-closed',
  'pickup-outside-service-window',
  'pickup-time-not-aligned',
  'pickup-too-soon',
]);

/**
 * El saldo ya alcanza para el pedido entero (409 `balance-covers-order`, B13):
 * el pago directo no cobra nada, así que hay que confirmarlo con el saldo
 * (F23). Pasa cuando el saldo que vio el cliente estaba desactualizado.
 */
export class BalanceCoversOrderError extends Error {
  constructor() {
    super('Tus almuerzos disponibles ahora alcanzan para este pedido. Confirmalo con tu saldo.');
    this.name = 'BalanceCoversOrderError';
  }
}

/**
 * La compra directa no está disponible (503 `direct-purchase-unavailable`)
 * — el backend no tiene un paquete `DAY` habilitado para calcular el precio
 * por almuerzo. F18/B7.
 */
export class DirectCheckoutUnavailableError extends Error {
  constructor() {
    super('El pago directo no está disponible ahora. Comprá un paquete para pedir.');
    this.name = 'DirectCheckoutUnavailableError';
  }
}

/**
 * El pago directo ya no se puede retomar — el pedido dejó de estar
 * `PENDIENTE_PAGO` (409 `order-not-awaiting-payment`, p. ej. se canceló o ya
 * se aprobó) o no queda una compra `DIRECT` pendiente para retomar (409
 * `direct-checkout-not-resumable`). Mismo mensaje para ambos: desde el punto
 * de vista del cliente, "Pagar ahora" ya no sirve. F18/B7.
 */
export class DirectCheckoutNotResumableError extends Error {
  constructor() {
    super('Este pago ya no se puede retomar.');
    this.name = 'DirectCheckoutNotResumableError';
  }
}

/**
 * Horarios de retiro válidos para `fecha` — únicamente los que ofrece el
 * backend (ventana de servicio, antelación, semana actual/siguiente,
 * fechas deshabilitadas). El frontend nunca genera horarios por su cuenta.
 */
export async function getPickupSlots(fecha: string): Promise<string[]> {
  // OJO: vive bajo /api/v1/orders (`OrderController`), no bajo `BASE` a secas
  // — el diseño reservó esta ruta ahí porque `OrderPlacementController`
  // (/api/v2/orders) no tiene un GET propio.
  const { data } = await api.get<string[]>(`${BASE}/orders/pickup-slots`, { params: { fecha } });
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
 * Respuesta de `POST /api/v2/orders/direct-checkout` y de
 * `GET /api/v2/orders/{id}/direct-checkout` (unidad B7/F18) — a diferencia
 * de {@link CreditPurchaseCheckout} (compra de créditos "sueltos"), esta
 * respuesta también trae `orderId`: el pedido y la compra DIRECT nacen
 * juntos, en la misma transacción del backend.
 */
export interface DirectCheckoutDto {
  orderId: number;
  purchaseId: string;
  initPoint: string;
}

/**
 * "Pagá este pedido con Mercado Pago" (F18, backend B7) — mismo body que
 * {@link placeOrderV2}, pero el pedido nace `PENDIENTE_PAGO` (sin comprometer
 * saldo, con stock reservado) junto a una compra DIRECT que cobra el total
 * exacto del pedido. El saldo insuficiente (o cero) nunca se calcula acá:
 * este endpoint se llama después de que `placeOrderV2` ya rechazó el pedido
 * con `InsufficientCreditsError`.
 */
export async function startDirectCheckoutV2(payload: PlaceOrderV2Payload): Promise<DirectCheckoutDto> {
  try {
    const { data } = await api.post<DirectCheckoutDto>(`${BASE_V2}/direct-checkout`, payload);
    return data;
  } catch (err) {
    throw mapOrderV2Error(err);
  }
}

/**
 * Retoma un pago directo abandonado ("Pagar ahora" sobre un pedido
 * `PENDIENTE_PAGO`, F18/B7) — NUNCA crea una compra ni un cobro nuevo, solo
 * devuelve el `initPoint` de la compra DIRECT `PENDING` ya persistida.
 */
export async function resumeDirectCheckoutV2(orderId: number): Promise<DirectCheckoutDto> {
  try {
    const { data } = await api.get<DirectCheckoutDto>(`${BASE_V2}/${orderId}/direct-checkout`);
    return data;
  } catch (err) {
    throw mapOrderV2Error(err);
  }
}

/**
 * Agrega ítems a un pedido v2 existente en vez de armar uno nuevo (F16,
 * backend B6 — `POST /api/v2/orders/{id}/items`). Solo funciona mientras el
 * pedido es modificable (`cancellable: true`, misma regla que cancelar); el
 * backend rechaza con `order-not-modifiable` si dejó de serlo.
 */
export async function addOrderItemsV2(orderId: number, items: OrderItemV2Payload[]): Promise<OrderV2> {
  try {
    const { data } = await api.post<OrderV2>(`${BASE_V2}/${orderId}/items`, { items });
    return data;
  } catch (err) {
    throw mapOrderV2Error(err);
  }
}

/**
 * Quita un plato de un pedido v2 existente (F16, backend B6 —
 * `DELETE /api/v2/orders/{id}/items/{itemId}`). Libera el almuerzo del
 * ítem; si era el último, el backend cancela el pedido entero y lo devuelve
 * con `estado: 'CANCELADO'`.
 */
export async function removeOrderItemV2(orderId: number, itemId: number): Promise<OrderV2> {
  try {
    const { data } = await api.delete<OrderV2>(`${BASE_V2}/${orderId}/items/${itemId}`);
    return data;
  } catch (err) {
    throw mapOrderV2Error(err);
  }
}

/**
 * Cambia el horario de retiro de un pedido programado (F19, backend B11 —
 * `PATCH /api/v2/orders/{id}/pickup-time`). `pickupAt` es el instante exacto
 * que devolvió `getPickupSlots` del mismo día; el backend decide si todavía
 * se puede cambiar y devuelve el pedido actualizado.
 */
export async function changeOrderPickupTimeV2(orderId: number, pickupAt: string): Promise<OrderV2> {
  try {
    const { data } = await api.patch<OrderV2>(`${BASE_V2}/${orderId}/pickup-time`, { pickupAt });
    return data;
  } catch (err) {
    throw mapOrderV2Error(err, { pickupTimeChange: true });
  }
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

/**
 * `pickupTimeChange`: solo el cambio de horario mapea los `pickup-*` a
 * {@link PickupTimeChangeError}; al crear un pedido o agregar platos esos
 * errores conservan su comportamiento anterior (F19.1).
 */
function mapOrderV2Error(err: unknown, { pickupTimeChange = false }: { pickupTimeChange?: boolean } = {}): Error {
  if (typeof err === 'object' && err !== null && 'response' in err) {
    const data = (err as { response?: { data?: { title?: string; detail?: string } } }).response?.data;
    if (pickupTimeChange && data?.title && PICKUP_TIME_ERROR_TITLES.has(data.title)) {
      const fallback =
        data.title === 'pickup-time-locked'
          ? 'El horario de retiro ya no se puede cambiar.'
          : 'No pudimos cambiar el horario de retiro.';
      return new PickupTimeChangeError(data.detail || fallback);
    }
    if (data?.title === 'insufficient-credits') {
      return new InsufficientCreditsError();
    }
    if (data?.title === 'balance-covers-order') {
      return new BalanceCoversOrderError();
    }
    if (data?.title === 'order-not-modifiable') {
      return new OrderNotModifiableError();
    }
    if (data?.title === 'direct-purchase-unavailable') {
      return new DirectCheckoutUnavailableError();
    }
    if (data?.title === 'order-not-awaiting-payment' || data?.title === 'direct-checkout-not-resumable') {
      return new DirectCheckoutNotResumableError();
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
