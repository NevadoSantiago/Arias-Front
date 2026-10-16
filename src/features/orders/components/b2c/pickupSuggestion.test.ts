import { describe, expect, it } from 'vitest';
import { suggestPickupTime } from './pickupSuggestion';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Local "HH:MM" of the instant, independent of the environment timezone. */
function localHM(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function order(id: number, fecha: string, pickupAt: string, estado = 'CONFIRMADO') {
  return { id, fecha, pickupAt, estado };
}

// 2026-10-19 is a Monday; 2026-10-12 the previous Monday; 2026-10-15 a Thursday.
const MON_PREV = '2026-10-12T15:00:00Z';
const THU = '2026-10-15T17:30:00Z';

describe('suggestPickupTime', () => {
  it('returns null when there are no orders', () => {
    expect(suggestPickupTime([], '2026-10-19')).toBeNull();
  });

  it('suggests the time of the last order on the same weekday, labelled in lowercase Spanish', () => {
    const result = suggestPickupTime([order(1, '2026-10-12', MON_PREV), order(2, '2026-10-15', THU)], '2026-10-19');
    expect(result).toEqual({ time: localHM(MON_PREV), source: 'sameWeekday', weekdayLabel: 'lunes' });
  });

  it('picks the most recent fecha, then the highest id, among same-weekday orders', () => {
    const older = '2026-10-05T13:00:00Z';
    const sameDayLow = '2026-10-12T14:00:00Z';
    const sameDayHigh = '2026-10-12T16:00:00Z';
    const result = suggestPickupTime(
      [order(9, '2026-10-05', older), order(3, '2026-10-12', sameDayHigh), order(2, '2026-10-12', sameDayLow)],
      '2026-10-19',
    );
    expect(result?.time).toBe(localHM(sameDayHigh));
    const tie = suggestPickupTime(
      [order(2, '2026-10-12', sameDayLow), order(3, '2026-10-12', sameDayHigh)],
      '2026-10-19',
    );
    expect(tie?.time).toBe(localHM(sameDayHigh));
  });

  it('ignores same-weekday orders that are not strictly before the selected date', () => {
    const result = suggestPickupTime([order(1, '2026-10-19', MON_PREV), order(2, '2026-10-26', MON_PREV)], '2026-10-19');
    expect(result?.source).toBe('lastOrder');
  });

  it('ignores cancelled orders in both rules', () => {
    const cancelledMonday = order(5, '2026-10-12', MON_PREV, 'CANCELADO');
    expect(suggestPickupTime([cancelledMonday], '2026-10-19')).toBeNull();
    const result = suggestPickupTime([cancelledMonday, order(2, '2026-10-15', THU)], '2026-10-19');
    expect(result).toEqual({ time: localHM(THU), source: 'lastOrder', weekdayLabel: 'lunes' });
  });

  it('falls back to the highest-id non-cancelled order when no same-weekday order exists', () => {
    const result = suggestPickupTime([order(7, '2026-10-14', MON_PREV), order(8, '2026-10-15', THU)], '2026-10-19');
    expect(result).toEqual({ time: localHM(THU), source: 'lastOrder', weekdayLabel: 'lunes' });
  });

  it('labels the weekday of the selected date', () => {
    const result = suggestPickupTime([order(1, '2026-10-08', THU)], '2026-10-15');
    expect(result).toEqual({ time: localHM(THU), source: 'sameWeekday', weekdayLabel: 'jueves' });
  });
});
