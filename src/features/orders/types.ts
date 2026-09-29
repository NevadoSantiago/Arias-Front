/**
 * Tipos del feature de orders.
 * Estos matchean (en su forma serializada) lo que vamos a recibir del backend.
 */

export type SideType = 'GUARNICION' | 'SALSA';

export interface Category {
  id: number;
  nombre: string;
  parentId: number | null;
  /**
   * Costo en créditos ("almuerzos") de los platos de esta categoría, tal
   * como lo reporta el backend — nunca se recalcula ni se hardcodea en el
   * cliente (proposal `b2c-credits-pivot`, "Vocabulario").
   */
  creditCost: number;
}

/** Sección gastronómica del menú (independiente del tier de acceso) */
export interface MenuSection {
  id: number;
  nombre: string;
  ordenDisplay: number;
}

export interface Side {
  id: number;
  nombre: string;
  tipo: SideType;
  enabled: boolean;
}

export interface Dish {
  id: number;
  nombre: string;
  descripcion: string;
  fotoUrl: string | null;
  category: Category; // tier de acceso (Premium/Básico/etc.) — uso interno
  menuSection: MenuSection; // sección visual (Pastas/Carnes/etc.) — la que ve el empleado
  /** Si es null, el plato no lleva ningún acompañamiento */
  sideType: SideType | null;
  /** Sides permitidos para este plato (filtrados por sideType del lado del back) */
  allowedSides: Side[];
  stockActual: number;
  especial: boolean;
}

/**
 * Compartido por el pedido viejo (`DailyChoice`, sin `CANCELADO` porque
 * cancela con DELETE) y el pedido nuevo por créditos (`Order`, que sí puede
 * llegar a `CANCELADO` — soft-cancel, ver `OrderV2` en `ordersApi.ts`).
 * `PENDIENTE_PAGO` (unidad B7/F18) es exclusivo de `Order`: pedido recién
 * creado por `/api/v2/orders/direct-checkout`, esperando que Mercado Pago
 * apruebe la compra DIRECT asociada, sin créditos comprometidos.
 */
export type OrderEstado = 'PENDIENTE_PAGO' | 'PENDIENTE' | 'CONFIRMADO' | 'COMANDADO' | 'ENTREGADO' | 'CANCELADO';

export interface DailyChoice {
  id: number;
  fecha: string; // ISO date "2026-05-21"
  estado: OrderEstado;
  dishId: number;
  dishNombre: string;
  dishCategoria: string;
  sideId: number | null;
  sideNombre: string | null;
  notas: string | null;
  /** Hora de entrega para la empresa del usuario (snapshot al confirmar) */
  horaEntrega: string; // "12:30"
  /** Estado actual del plato/side — si alguno es false, el pedido necesita modificación */
  dishEnabled: boolean;
  sideEnabled: boolean | null; // null cuando el pedido no tiene side
}

/** Franja de retiro de un día de la semana (B5/F14). */
export interface PickupScheduleDay {
  dayOfWeek: number; // ISO 1..7, 1 = lunes
  open: boolean;
  windowStart: string | null; // "11:00"
  windowEnd: string | null; // "23:00"
}

export interface RestaurantConfig {
  horaCorte: string; // "10:00"
  /**
   * Ventana de servicio de retiro global — DEPRECATED, reemplazada por
   * `pickupSchedule` (B5/F14). Se mantiene por compatibilidad con un
   * backend viejo (fallback en `B2cOrderPage`, F14b). `null` si el
   * restaurante no la tiene configurada; la UI oculta la etiqueta de
   * horario en ese caso (F3.1).
   */
  pickupWindowStart: string | null; // "11:00"
  pickupWindowEnd: string | null; // "23:00"
  /** Franja de retiro por día de la semana (lunes a domingo). Ausente en un backend viejo (tolerancia, F14b). */
  pickupSchedule?: PickupScheduleDay[];
  /**
   * Minutos de antelación al retiro que usa el backend para la ventana de
   * cancelación/modificación (`OrderPlacementService.isCancellable`) y para
   * el corte que cancela solo un pedido `PENDIENTE_PAGO` sin pagar (F18).
   * Optional: `getRestaurantConfig` lo mapea tolerante a un valor ausente,
   * y la UI omite el horario del aviso cuando no está.
   */
  pickupLeadMinutes?: number;
  /**
   * Días que duran los almuerzos desde la última compra (`restaurant_config.credit_expiry_days`,
   * configurable por el admin). Lo lee "Tu compra" de la compra de almuerzos (F22c.1).
   * Optional: tolerante a un backend viejo sin el campo.
   */
  creditExpiryDays?: number;
}
