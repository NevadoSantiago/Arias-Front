import { describe, expect, it } from 'vitest';
import { nextOpenDate } from './nextOpenDate';
import type { PickupScheduleDay } from '@/features/orders/types';

// Semana del lunes 2026-10-19 y la siguiente (lunes a viernes), como las devuelve `selectableDates`.
const CANDIDATES = [
  '2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23',
  '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30',
];
const TODAY = '2026-10-19';

function schedule(closedWeekdays: number[]): PickupScheduleDay[] {
  return [1, 2, 3, 4, 5, 6, 7].map((dayOfWeek) =>
    closedWeekdays.includes(dayOfWeek)
      ? { dayOfWeek, open: false, windowStart: null, windowEnd: null }
      : { dayOfWeek, open: true, windowStart: '11:00', windowEnd: '23:00' },
  );
}

describe('nextOpenDate', () => {
  it('skips the selected date and earlier dates', () => {
    expect(nextOpenDate('2026-10-21', TODAY, CANDIDATES, new Set(), undefined)).toBe('2026-10-22');
  });

  it('skips a date closed by the admin', () => {
    expect(nextOpenDate('2026-10-21', TODAY, CANDIDATES, new Set(['2026-10-22']), undefined)).toBe('2026-10-23');
  });

  it('skips a weekday that is closed in the schedule', () => {
    // jueves (4) cerrado: del miércoles 21 salta al viernes 23
    expect(nextOpenDate('2026-10-21', TODAY, CANDIDATES, new Set(), schedule([4]))).toBe('2026-10-23');
  });

  it('skips a weekday open without a window', () => {
    const sched: PickupScheduleDay[] = [{ dayOfWeek: 4, open: true, windowStart: null, windowEnd: '23:00' }];
    expect(nextOpenDate('2026-10-21', TODAY, CANDIDATES, new Set(), sched)).toBe('2026-10-23');
  });

  it('treats every candidate as open without a schedule', () => {
    expect(nextOpenDate('2026-10-23', TODAY, CANDIDATES, new Set(), undefined)).toBe('2026-10-26');
    expect(nextOpenDate('2026-10-23', TODAY, CANDIDATES, new Set(), [])).toBe('2026-10-26');
  });

  it('treats a weekday missing from the schedule as open', () => {
    const sched: PickupScheduleDay[] = [{ dayOfWeek: 1, open: false, windowStart: null, windowEnd: null }];
    expect(nextOpenDate('2026-10-21', TODAY, CANDIDATES, new Set(), sched)).toBe('2026-10-22');
  });

  it('returns null when nothing is left', () => {
    expect(nextOpenDate('2026-10-30', TODAY, CANDIDATES, new Set(), undefined)).toBeNull();
    expect(nextOpenDate('2026-10-23', TODAY, CANDIDATES, new Set(CANDIDATES), undefined)).toBeNull();
  });

  it('skips a candidate before today', () => {
    // seleccionada anterior a hoy: 19 y 20 quedan antes de hoy (21)
    expect(nextOpenDate('2026-10-18', '2026-10-21', CANDIDATES, new Set(), undefined)).toBe('2026-10-21');
  });
});
