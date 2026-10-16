export interface PickupSuggestion {
  /** Local "HH:MM" of the suggested pickup. */
  time: string;
  /** `sameWeekday`: last order on the same weekday; `lastOrder`: last order overall. */
  source: 'sameWeekday' | 'lastOrder';
  /** Lowercase Spanish weekday of the SELECTED date ("lunes"). */
  weekdayLabel: string;
}

interface SuggestionOrder {
  id: number;
  fecha: string;
  pickupAt: string;
  estado: string;
}

/** "YYYY-MM-DD" as a LOCAL date (never `new Date('YYYY-MM-DD')`, which is UTC). */
function parseLocalDate(fecha: string): Date {
  const [y, m, d] = fecha.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function localTimeOfDay(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * Pickup time to suggest for `fecha`: the time of the last non-cancelled order
 * on the same weekday strictly before it; otherwise the last non-cancelled
 * order (highest `id`); otherwise `null`. The caller still has to check that
 * the time matches one of the day's slots.
 */
export function suggestPickupTime(
  orders: ReadonlyArray<SuggestionOrder>,
  fecha: string,
): PickupSuggestion | null {
  const nonCancelled = orders.filter((o) => o.estado !== 'CANCELADO');
  if (nonCancelled.length === 0) return null;

  const target = parseLocalDate(fecha);
  const weekdayLabel = target.toLocaleDateString('es-AR', { weekday: 'long' }).toLowerCase();

  const sameWeekday = nonCancelled.filter((o) => {
    const d = parseLocalDate(o.fecha);
    return d.getDay() === target.getDay() && d.getTime() < target.getTime();
  });
  if (sameWeekday.length > 0) {
    const latest = sameWeekday.reduce((a, b) =>
      b.fecha > a.fecha || (b.fecha === a.fecha && b.id > a.id) ? b : a,
    );
    return { time: localTimeOfDay(latest.pickupAt), source: 'sameWeekday', weekdayLabel };
  }

  const latest = nonCancelled.reduce((a, b) => (b.id > a.id ? b : a));
  return { time: localTimeOfDay(latest.pickupAt), source: 'lastOrder', weekdayLabel };
}
