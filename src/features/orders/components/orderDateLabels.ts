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

/** "HH:MM" en horario de 24hs. */
export function formatOrderTimeLabel(pickupAt: string): string {
  return new Date(pickupAt).toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
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
