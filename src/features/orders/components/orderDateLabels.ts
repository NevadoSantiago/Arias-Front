/**
 * Etiquetas de fecha/hora para las tarjetas y la hoja de cancelación de
 * "Mis pedidos" (F10, prototipo `MyOrders.dc.html`). Compartidas por
 * `OrderCard` y `CancelOrderSheet` para no duplicar el formato.
 */

/** "Hoy, sábado 26 de septiembre" si `pickupAt` cae el mismo día que `now`, si no "Sábado 26 de septiembre". */
export function formatOrderDayLabel(pickupAt: string, now: Date): string {
  const date = new Date(pickupAt);
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  const formatted = date.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
  if (sameDay) return `Hoy, ${formatted}`;
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

/** "HH:MM" en horario de 24hs. */
export function formatOrderTimeLabel(pickupAt: string): string {
  return new Date(pickupAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
}
