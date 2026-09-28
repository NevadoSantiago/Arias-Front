/**
 * Etiquetas de fecha/hora para las tarjetas y la hoja de cancelación de
 * "Mis pedidos" (F10, prototipo `MyOrders.dc.html`). Compartidas por
 * `OrderCard` y `CancelOrderSheet` para no duplicar el formato.
 *
 * El retiro es en el local, así que día y hora se muestran siempre en la
 * zona horaria del restaurante, no en la del navegador o la del servidor
 * de CI.
 */

const RESTAURANT_TIME_ZONE = 'America/Argentina/Buenos_Aires';

/** Fecha calendario "AAAA-MM-DD" del instante en la zona del restaurante. */
function restaurantDateKey(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: RESTAURANT_TIME_ZONE });
}

/** "Hoy, sábado 26 de septiembre" si `pickupAt` cae el mismo día que `now`, si no "Sábado 26 de septiembre". */
export function formatOrderDayLabel(pickupAt: string, now: Date): string {
  const date = new Date(pickupAt);
  const sameDay = restaurantDateKey(date) === restaurantDateKey(now);
  const formatted = date.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: RESTAURANT_TIME_ZONE,
  });
  if (sameDay) return `Hoy, ${formatted}`;
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

/**
 * "HH:MM" en horario de 24hs. Usa `hourCycle: 'h23'` en vez de
 * `hour12: false` — en algunos builds de ICU, `hour12: false` igual
 * renderiza la medianoche como "24:00" en vez de "00:00"; `hourCycle: 'h23'`
 * es la opción que fuerza el rango 0-23 de forma consistente.
 */
export function formatOrderTimeLabel(pickupAt: string): string {
  return new Date(pickupAt).toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: RESTAURANT_TIME_ZONE,
  });
}

/**
 * True si `pickupAt` cae el mismo día calendario que `now`, en la zona del
 * restaurante (F17: "Mis pedidos" la usa para decidir si un CONFIRMADO
 * cuenta como "de hoy").
 */
export function isSameRestaurantDay(pickupAt: string, now: Date): boolean {
  return restaurantDateKey(new Date(pickupAt)) === restaurantDateKey(now);
}

/**
 * True si `pickupAt` cae hoy o en un día posterior, en la zona del
 * restaurante (F17 fix: "Mis pedidos" la usa para decidir si un CONFIRMADO
 * cuenta como "próximo" por defecto — no solo los de hoy). Las claves son
 * "AAAA-MM-DD", así que la comparación lexicográfica alcanza.
 */
export function isRestaurantDayOnOrAfter(pickupAt: string, now: Date): boolean {
  return restaurantDateKey(new Date(pickupAt)) >= restaurantDateKey(now);
}

/**
 * Hora de corte "HH:MM" de un pedido `PENDIENTE_PAGO` (F18) — `pickupAt`
 * menos `leadMinutes` (`getRestaurantConfig().pickupLeadMinutes`), en la
 * zona del restaurante: la misma ventana que usa el backend para
 * `isCancellable`/`assertModifiable` y para el corte que cancela solo un
 * pedido sin pagar. `null` cuando `leadMinutes` no se conoce (backend viejo,
 * config sin cargar) — el llamador omite el horario en ese caso.
 */
export function formatOrderPayDeadlineLabel(pickupAt: string, leadMinutes: number | null | undefined): string | null {
  if (leadMinutes == null) return null;
  const deadline = new Date(new Date(pickupAt).getTime() - leadMinutes * 60_000);
  // `hourCycle: 'h23'` instead of `hour12: false` — see `formatOrderTimeLabel`.
  return deadline.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: RESTAURANT_TIME_ZONE,
  });
}
