function getWeekdays(mondayDate: Date): string[] {
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(mondayDate);
    d.setDate(mondayDate.getDate() + i);
    return d.toISOString().split('T')[0];
  });
}

function getMondayOf(date: string): Date {
  const d = new Date(date + 'T12:00:00');
  const dow = d.getDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(d);
  monday.setDate(d.getDate() + mondayOffset);
  return monday;
}

/**
 * Fechas (AAAA-MM-DD locales) de las fichas que muestra `WeekDaySelector`, en el orden en que se ven:
 * lunes a viernes de la semana actual y de la próxima o, con `includeWeekendToday` en sábado o
 * domingo, hoy seguido de la semana próxima. Incluye días pasados o cerrados: el selector los
 * pinta deshabilitados y quien la usa para elegir un día los filtra por su cuenta.
 */
export function selectableDates(today: string, { includeWeekendToday = false } = {}): string[] {
  const currentMonday = getMondayOf(today);
  const nextMonday = new Date(currentMonday);
  nextMonday.setDate(nextMonday.getDate() + 7);
  const nextWeek = getWeekdays(nextMonday);
  const dow = new Date(today + 'T12:00:00').getDay();
  if (includeWeekendToday && (dow === 0 || dow === 6)) return [today, ...nextWeek];
  return [...getWeekdays(currentMonday), ...nextWeek];
}
