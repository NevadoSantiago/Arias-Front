/** The restaurant runs on Buenos Aires time; the print screens show it regardless of the browser. */
export const PRINT_TIMEZONE = 'America/Argentina/Buenos_Aires';

function parts(date: Date, options: Intl.DateTimeFormatOptions): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of new Intl.DateTimeFormat('en-GB', { timeZone: PRINT_TIMEZONE, hourCycle: 'h23', ...options })
    .formatToParts(date)) {
    out[p.type] = p.value;
  }
  return out;
}

/** HH:MM, or HH:MM:SS with `seconds`. */
export function formatClock(iso: string, seconds = false): string {
  const p = parts(new Date(iso), {
    hour: '2-digit', minute: '2-digit', ...(seconds && { second: '2-digit' }),
  });
  return seconds ? `${p.hour}:${p.minute}:${p.second}` : `${p.hour}:${p.minute}`;
}

/** "hoy HH:MM" for today, otherwise "dd/mm/aaaa HH:MM" (with seconds when asked). */
export function formatStamp(iso: string, now: Date, seconds = false): string {
  const date = new Date(iso);
  const d = parts(date, { day: '2-digit', month: '2-digit', year: 'numeric' });
  const n = parts(now, { day: '2-digit', month: '2-digit', year: 'numeric' });
  const clock = formatClock(iso, seconds);
  if (d.day === n.day && d.month === n.month && d.year === n.year) return `hoy ${clock}`;
  return `${d.day}/${d.month}/${d.year} ${clock}`;
}
