import type { PickupScheduleDay } from '@/features/orders/types';

/** Día ISO de la semana (1..7, 1 = lunes) de "YYYY-MM-DD", como fecha LOCAL (mismo patrón que la página). */
function isoWeekdayOf(date: string): number {
  const day = new Date(date + 'T12:00:00').getDay();
  return day === 0 ? 7 : day;
}

/** Abierto en la agenda semanal; sin agenda, o sin entrada para ese día, cuenta como abierto. */
function isOpenInSchedule(date: string, schedule: PickupScheduleDay[] | undefined): boolean {
  if (!schedule || schedule.length === 0) return true;
  const entry = schedule.find((d) => d.dayOfWeek === isoWeekdayOf(date));
  if (!entry) return true;
  return entry.open && entry.windowStart !== null && entry.windowEnd !== null;
}

/**
 * Próximo día abierto para pedir: la primera fecha de `candidates` (en el orden de la pantalla)
 * posterior a `selectedDate`, no anterior a hoy, no cerrada por el admin y abierta en la agenda
 * semanal. `null` si no queda ninguna. No consulta los horarios del día: si está abierto en la
 * agenda, se asume que tiene horarios.
 */
export function nextOpenDate(
  selectedDate: string,
  todayStr: string,
  candidates: string[],
  disabledDates: Set<string>,
  schedule: PickupScheduleDay[] | undefined,
): string | null {
  return (
    candidates.find(
      (date) =>
        date > selectedDate && date >= todayStr && !disabledDates.has(date) && isOpenInSchedule(date, schedule),
    ) ?? null
  );
}
