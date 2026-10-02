import { describe, expect, it } from 'vitest';
import type { PickupOrderItem } from '@/features/admin/services/adminApi';
import { buildDayOptions, resolveDay, summarizeDishes } from './dashboardDay';

const TZ = 'America/Argentina/Buenos_Aires';
// 12:00 in Buenos Aires.
const FRIDAY = new Date('2026-10-02T15:00:00Z');
const SUNDAY = new Date('2026-10-04T15:00:00Z');
const MONDAY = new Date('2026-10-05T15:00:00Z');

const schedule = [1, 2, 3, 4, 5, 6, 7].map((d) => ({
  dayOfWeek: d,
  open: d !== 7,
  windowStart: d !== 7 ? '11:00' : null,
  windowEnd: d !== 7 ? '23:00' : null,
}));

const options = (now: Date, disabledDates: { fecha: string; motivo: string | null }[] = []) =>
  buildDayOptions({ now, timezone: TZ, schedule, disabledDates });

describe('buildDayOptions', () => {
  it('runs from Friday to Sunday of next week, with Hoy and Mañana first', () => {
    const list = options(FRIDAY);
    expect(list.map((o) => o.date)).toEqual([
      '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06',
      '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11',
    ]);
    expect(list.slice(0, 4).map((o) => o.label)).toEqual(['Hoy', 'Mañana', 'Dom 4/10 · cerrado', 'Lun 5/10']);
    expect(list.at(-1)?.label).toBe('Dom 11/10 · cerrado');
  });

  it('on a Monday it spans two full weeks', () => {
    const list = options(MONDAY);
    expect(list).toHaveLength(14);
    expect(list[0].date).toBe('2026-10-05');
    expect(list[13].date).toBe('2026-10-18');
  });

  it('on a Sunday it only reaches the next Sunday', () => {
    const list = options(SUNDAY);
    expect(list).toHaveLength(8);
    expect(list[0]).toMatchObject({ date: '2026-10-04', isToday: true, status: 'closed' });
    expect(list[1].label).toBe('Mañana');
    expect(list[7].date).toBe('2026-10-11');
  });

  it('reads today in the restaurant timezone, not in UTC', () => {
    // 01:00 UTC of Saturday is still Friday night in Buenos Aires.
    const list = options(new Date('2026-10-03T01:00:00Z'));
    expect(list[0].date).toBe('2026-10-02');
  });

  it('marks closed weekdays and disabled dates but keeps them selectable', () => {
    const list = options(FRIDAY, [{ fecha: '2026-10-06', motivo: 'Feriado' }]);
    const sun = list.find((o) => o.date === '2026-10-04');
    const tue = list.find((o) => o.date === '2026-10-06');
    expect(sun).toMatchObject({ status: 'closed', longLabel: 'domingo 4/10' });
    expect(tue).toMatchObject({ status: 'disabled', motivo: 'Feriado', label: 'Mar 6/10 · deshabilitado' });
    expect(list.find((o) => o.date === '2026-10-05')).toMatchObject({ status: 'open', motivo: null });
  });

  it('treats every day as open while the schedule is unknown', () => {
    const list = buildDayOptions({ now: FRIDAY, timezone: TZ, schedule: undefined, disabledDates: [] });
    expect(list.every((o) => o.status === 'open')).toBe(true);
  });
});

describe('resolveDay', () => {
  const list = options(FRIDAY);

  it('returns the option for a valid date', () => {
    expect(resolveDay('2026-10-07', list).date).toBe('2026-10-07');
  });

  it.each([null, '', 'mañana', '2026-13-45', '2026-10-01', '2026-10-12', '2027-01-01'])(
    'falls back to today for %s',
    (value) => {
      expect(resolveDay(value, list).date).toBe('2026-10-02');
    },
  );
});

const dish = (dishNombre: string, sideNombre: string | null): Pick<PickupOrderItem, 'dishNombre' | 'sideNombre'> => ({
  dishNombre,
  sideNombre,
});
const orderOf = (...items: ReturnType<typeof dish>[]) => ({ items });

describe('summarizeDishes', () => {
  it('is empty without orders', () => {
    expect(summarizeDishes([])).toEqual({ total: 0, dishes: [] });
  });

  it('counts every dish of every order and the total', () => {
    const summary = summarizeDishes([
      orderOf(dish('Milanesa', 'Papas fritas'), dish('Milanesa', 'Papas fritas')),
      orderOf(dish('Milanesa', 'Ensalada mixta'), dish('Tarta', 'Ensalada mixta')),
    ]);
    expect(summary.total).toBe(4);
    expect(summary.dishes.map((d) => [d.name, d.count])).toEqual([
      ['Milanesa', 3],
      ['Tarta', 1],
    ]);
  });

  it('breaks the sides down, most common first, and adds the ones without side', () => {
    const summary = summarizeDishes([
      orderOf(dish('Milanesa', 'Ensalada mixta'), dish('Milanesa', 'Papas fritas')),
      orderOf(dish('Milanesa', 'Papas fritas'), dish('Milanesa', null), dish('Milanesa', null)),
    ]);
    expect(summary.dishes[0]).toMatchObject({
      name: 'Milanesa',
      count: 5,
      breakdown: '2 c/ Papas fritas · 1 c/ Ensalada mixta · 2 sin acompañamiento',
    });
  });

  it('shows only "sin acompañamiento" when no dish has a side', () => {
    const summary = summarizeDishes([orderOf(dish('Tarta', null))]);
    expect(summary.dishes[0].breakdown).toBe('1 sin acompañamiento');
  });

  it('sorts by count desc, then by name, and breaks side ties by name', () => {
    const summary = summarizeDishes([
      orderOf(dish('Zapallo', 'Arroz'), dish('Bife', 'Puré'), dish('Bife', 'Arroz'), dish('Ñoquis', null)),
    ]);
    expect(summary.dishes.map((d) => d.name)).toEqual(['Bife', 'Ñoquis', 'Zapallo']);
    expect(summary.dishes[0].breakdown).toBe('1 c/ Arroz · 1 c/ Puré');
  });
});
