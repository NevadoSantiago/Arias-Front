import { describe, expect, it } from 'vitest';
import { buildPickupHours, type PickupHoursInput } from './pickupHours';

const TZ = 'America/Argentina/Buenos_Aires'; // UTC-3, no DST

/** Local Buenos Aires wall clock to a Date. 2026-10-01 is a Thursday. */
const at = (date: string, time: string) => new Date(`${date}T${time}-03:00`);

const openDay = (dayOfWeek: number, windowStart = '11:00', windowEnd = '15:00') => ({
  dayOfWeek,
  open: true,
  windowStart,
  windowEnd,
});
const closedDay = (dayOfWeek: number) => ({ dayOfWeek, open: false, windowStart: null, windowEnd: null });

const allOpen = [1, 2, 3, 4, 5, 6, 7].map((d) => openDay(d));

function input(overrides: Partial<PickupHoursInput> = {}): PickupHoursInput {
  return {
    now: at('2026-10-01', '14:00:00'),
    timezone: TZ,
    leadMinutes: 20,
    slotMinutes: 10,
    schedule: allOpen,
    disabledDates: [],
    ...overrides,
  };
}

describe('buildPickupHours — today', () => {
  it('offers the next slot after now + lead and counts the remaining ones', () => {
    const { today } = buildPickupHours(input());

    expect(today).toMatchObject({
      kind: 'available',
      range: '11:00 a 15:00',
      last: '14:50',
      next: '14:20',
      remaining: 4, // 14:20, 14:30, 14:40, 14:50
    });
  });

  it('excludes the closing time from the slots', () => {
    const { today } = buildPickupHours(input({ schedule: allOpen.map((d) => ({ ...d, windowEnd: '14:30' })) }));

    expect(today).toMatchObject({ kind: 'available', last: '14:20' });
  });

  it('aligns the slots to the window start, not to the clock', () => {
    const { today } = buildPickupHours(
      input({ schedule: allOpen.map((d) => ({ ...d, windowStart: '11:05' })) }),
    );

    expect(today).toMatchObject({ kind: 'available', last: '14:55', next: '14:25' });
  });

  it('includes a slot exactly at now + lead, but not when now has extra seconds', () => {
    const exact = buildPickupHours(input({ now: at('2026-10-01', '14:30:00') })).today;
    const late = buildPickupHours(input({ now: at('2026-10-01', '14:30:30') })).today;

    expect(exact).toMatchObject({ kind: 'available', next: '14:50', remaining: 1 });
    expect(late).toMatchObject({ kind: 'ended' });
  });

  it('says there are no slots left and points to the next open day', () => {
    const { today } = buildPickupHours(input({ now: at('2026-10-01', '14:35:00') }));

    expect(today).toMatchObject({
      kind: 'ended',
      range: '11:00 a 15:00',
      last: '14:50',
      nextOpen: 'Viernes desde las 11:00',
    });
  });

  it('reports a closed weekday and the next open day', () => {
    const schedule = allOpen.map((d) => (d.dayOfWeek === 4 ? closedDay(4) : d));
    const { today } = buildPickupHours(input({ schedule }));

    expect(today).toEqual({ kind: 'closed', nextOpen: 'Viernes desde las 11:00' });
  });

  it('reports a disabled date with its reason, and skips closed and disabled days for the next one', () => {
    const schedule = allOpen.map((d) => (d.dayOfWeek === 5 ? closedDay(5) : d));
    const { today } = buildPickupHours(
      input({
        schedule,
        disabledDates: [
          { fecha: '2026-10-01', motivo: 'Feriado' },
          { fecha: '2026-10-03', motivo: null },
        ],
      }),
    );

    expect(today).toEqual({ kind: 'disabled', motivo: 'Feriado', nextOpen: 'Domingo desde las 11:00' });
  });

  it('has no next open day when nothing opens within the schedulable weeks', () => {
    const { today } = buildPickupHours(input({ schedule: allOpen.map((d) => closedDay(d.dayOfWeek)) }));

    expect(today).toEqual({ kind: 'closed', nextOpen: null });
  });

  it('reads the day in the restaurant timezone, not the browser one', () => {
    // 02:30Z on Oct 2 is still Thursday 23:30 in Buenos Aires.
    const schedule = allOpen.map((d) => (d.dayOfWeek === 4 ? openDay(4, '20:00', '23:40') : closedDay(d.dayOfWeek)));
    const { today } = buildPickupHours(input({ now: new Date('2026-10-02T02:30:00Z'), schedule }));

    expect(today).toMatchObject({ kind: 'ended', range: '20:00 a 23:40' });
  });
});

describe('buildPickupHours — week', () => {
  it('lists Monday to Sunday of the current week with today highlighted', () => {
    const { week } = buildPickupHours(input());

    expect(week.map((d) => d.name)).toEqual([
      'Lunes',
      'Martes',
      'Miércoles',
      'Jueves',
      'Viernes',
      'Sábado',
      'Domingo',
    ]);
    expect(week.filter((d) => d.isToday).map((d) => d.name)).toEqual(['Jueves']);
    expect(week[0]).toMatchObject({ kind: 'open', range: '11:00 a 15:00', last: '14:50' });
  });

  it('marks closed weekdays and disabled dates', () => {
    const schedule = allOpen.map((d) => (d.dayOfWeek === 7 ? closedDay(7) : d));
    const { week } = buildPickupHours(
      input({ schedule, disabledDates: [{ fecha: '2026-10-02', motivo: 'Feriado puente' }] }),
    );

    expect(week[6]).toMatchObject({ kind: 'closed', name: 'Domingo' });
    expect(week[4]).toMatchObject({ kind: 'disabled', name: 'Viernes', motivo: 'Feriado puente' });
  });

  it('treats a missing schedule day as closed', () => {
    const { week } = buildPickupHours(input({ schedule: allOpen.filter((d) => d.dayOfWeek !== 2) }));

    expect(week[1]).toMatchObject({ kind: 'closed', name: 'Martes' });
  });
});
