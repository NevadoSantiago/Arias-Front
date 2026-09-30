import { describe, expect, it } from 'vitest';
import { buildOrderWeeks, weekKeyOfOrder } from './myOrdersWeeks';
import type { OrderV2 } from '../../services/ordersApi';
import type { PickupScheduleDay } from '../../types';

// "Hoy": jueves 24 de septiembre de 2026, 11:40 en Buenos Aires (como el tablero de diseño).
const NOW = new Date('2026-09-24T11:40:00-03:00');

const order = (id: number, pickupAt: string, extra: Partial<OrderV2> = {}): OrderV2 => ({
  id,
  fecha: pickupAt.slice(0, 10),
  pickupAt,
  estado: 'PENDIENTE',
  creditTotal: 1,
  notas: null,
  items: [],
  cancellable: true,
  modifiable: true,
  pickupTimeChangeable: true,
  paidWithMercadoPago: false,
  creditsFromBalance: 0,
  ...extra,
});

const weekdaysOpen = (open: number[]): PickupScheduleDay[] =>
  [1, 2, 3, 4, 5, 6, 7].map((dayOfWeek) => ({
    dayOfWeek,
    open: open.includes(dayOfWeek),
    windowStart: open.includes(dayOfWeek) ? '11:00' : null,
    windowEnd: open.includes(dayOfWeek) ? '23:00' : null,
  }));

const MON_TO_FRI = weekdaysOpen([1, 2, 3, 4, 5]);

function build(upcoming: OrderV2[], extra: Partial<Parameters<typeof buildOrderWeeks>[0]> = {}) {
  return buildOrderWeeks({ upcoming, past: [], now: NOW, schedule: MON_TO_FRI, ...extra });
}

describe('buildOrderWeeks', () => {
  it('returns this week and next week with their labels and date ranges', () => {
    const [esta, proxima] = build([]);

    expect(esta).toMatchObject({ key: 'esta', label: 'Esta semana', rangeLabel: '21–25 sep' });
    expect(proxima).toMatchObject({ key: 'proxima', label: 'Semana próxima', rangeLabel: '28 sep – 2 oct' });
  });

  it('lists the open weekdays of the schedule, from today on, each with its number and weekday', () => {
    const [esta, proxima] = build([]);

    expect(esta.days.map((d) => `${d.weekday} ${d.dayNumber}`)).toEqual(['Jueves 24', 'Viernes 25']);
    expect(esta.days[0].isToday).toBe(true);
    expect(esta.days[1].isToday).toBe(false);
    expect(proxima.days.map((d) => `${d.weekday} ${d.dayNumber}`)).toEqual([
      'Lunes 28',
      'Martes 29',
      'Miércoles 30',
      'Jueves 1',
      'Viernes 2',
    ]);
  });

  it('folds the past open days of this week into one line', () => {
    const [esta, proxima] = build([]);

    expect(esta.pastDays).toEqual({ label: 'Lunes 21 a miércoles 23', orderCount: 0 });
    expect(proxima.pastDays).toBeNull();
  });

  it('counts the past orders that fall on the folded days', () => {
    const past = [
      order(1, '2026-09-22T13:00:00-03:00', { estado: 'CONFIRMADO' }),
      order(2, '2026-09-23T13:00:00-03:00', { estado: 'CANCELADO' }),
      order(3, '2026-09-18T13:00:00-03:00', { estado: 'CONFIRMADO' }),
    ];

    const [esta] = build([], { past });

    expect(esta.pastDays?.orderCount).toBe(2);
  });

  it('groups the orders under their day, sorted by pickup time, and counts them per week', () => {
    const late = order(1, '2026-09-25T14:00:00-03:00');
    const early = order(2, '2026-09-25T12:00:00-03:00');
    const next = order(3, '2026-09-29T12:30:00-03:00');

    const [esta, proxima] = build([late, early, next]);

    expect(esta.days[1].orders.map((o) => o.id)).toEqual([2, 1]);
    expect(esta.count).toBe(2);
    expect(proxima.days[1].orders.map((o) => o.id)).toEqual([3]);
    expect(proxima.count).toBe(1);
  });

  it('groups by the Buenos Aires day: an order at 23:30 local belongs to that day, not the UTC one', () => {
    // 2026-09-25T23:30-03:00 = 2026-09-26T02:30Z (ya es sábado en UTC).
    const nearMidnight = order(1, '2026-09-26T02:30:00Z');

    const [esta] = build([nearMidnight]);

    const friday = esta.days.find((d) => d.dayNumber === 25);
    expect(friday?.orders.map((o) => o.id)).toEqual([1]);
    expect(esta.days.some((d) => d.dayNumber === 26)).toBe(false);
  });

  it('decides "today" in Buenos Aires time even when the UTC date already rolled over', () => {
    // 23:30 del jueves 24 en Buenos Aires = viernes 25 02:30 UTC.
    const lateThursday = new Date('2026-09-25T02:30:00Z');

    const [esta] = buildOrderWeeks({ upcoming: [], past: [], now: lateThursday, schedule: MON_TO_FRI });

    expect(esta.days.find((d) => d.isToday)?.dayNumber).toBe(24);
  });

  it('leaves out the days the restaurant is closed', () => {
    const closedTuesday = weekdaysOpen([1, 3, 4, 5]);

    const [, proxima] = build([], { schedule: closedTuesday });

    expect(proxima.days.map((d) => d.dayNumber)).toEqual([28, 30, 1, 2]);
  });

  it('adds Saturday when the schedule opens it', () => {
    const [esta] = build([], { schedule: weekdaysOpen([1, 2, 3, 4, 5, 6]) });

    expect(esta.days.map((d) => `${d.weekday} ${d.dayNumber}`)).toEqual(['Jueves 24', 'Viernes 25', 'Sábado 26']);
  });

  it('leaves out the disabled dates', () => {
    const [, proxima] = build([], { disabledDates: new Set(['2026-09-29']) });

    expect(proxima.days.map((d) => d.dayNumber)).toEqual([28, 30, 1, 2]);
  });

  it('falls back to Monday to Friday when the schedule is unknown', () => {
    const [, proxima] = build([], { schedule: undefined });

    expect(proxima.days).toHaveLength(5);
  });

  it('keeps a day with orders even if the schedule says it is closed or disabled', () => {
    const onClosedSaturday = order(1, '2026-09-26T13:00:00-03:00');
    const onDisabledTuesday = order(2, '2026-09-29T13:00:00-03:00');

    const [esta, proxima] = build([onClosedSaturday, onDisabledTuesday], {
      disabledDates: new Set(['2026-09-29']),
    });

    expect(esta.days.map((d) => d.dayNumber)).toEqual([24, 25, 26]);
    expect(proxima.days.find((d) => d.dayNumber === 29)?.orders.map((o) => o.id)).toEqual([2]);
  });

  it('keeps an order on a Sunday when the schedule is unknown (Monday to Friday fallback)', () => {
    const [esta, proxima] = build([order(1, '2026-09-27T13:00:00-03:00')], { schedule: undefined });

    expect(esta.days.find((d) => d.dayNumber === 27)?.orders.map((o) => o.id)).toEqual([1]);
    expect(esta.count).toBe(1);
    expect(proxima.count).toBe(0);
  });

  it('keeps and counts an order today on a day that became closed or disabled', () => {
    const [esta] = build([order(1, '2026-09-24T13:00:00-03:00')], {
      schedule: weekdaysOpen([1, 2, 3, 5]),
      disabledDates: new Set(['2026-09-24']),
    });

    expect(esta.days.find((d) => d.isToday)?.orders.map((o) => o.id)).toEqual([1]);
    expect(esta.count).toBe(1);
  });

  it('shows and counts a pending order of a day that already passed, instead of folding it away', () => {
    const [esta] = build([order(1, '2026-09-22T13:00:00-03:00', { estado: 'PENDIENTE_PAGO' })]);

    expect(esta.days.find((d) => d.dayNumber === 22)?.orders.map((o) => o.id)).toEqual([1]);
    expect(esta.count).toBe(1);
    // Los otros días pasados sin pedidos siguen resumidos en la línea.
    expect(esta.pastDays).toEqual({ label: 'Lunes 21 y miércoles 23', orderCount: 0 });
  });

  it('does not fold a past day that still has an active order into the past-days line', () => {
    const past = [order(9, '2026-09-22T12:00:00-03:00', { estado: 'CONFIRMADO' })];

    const [esta] = build([order(1, '2026-09-22T13:00:00-03:00')], { past });

    expect(esta.pastDays?.orderCount).toBe(0);
    expect(esta.days.map((d) => d.dayNumber)).toContain(22);
  });

  it('counts an order from before this week on this week instead of dropping it', () => {
    const [esta] = build([order(1, '2026-09-15T13:00:00-03:00')]);

    expect(esta.count).toBe(1);
    expect(esta.days.some((d) => d.orders.some((o) => o.id === 1))).toBe(true);
  });

  it('puts an order beyond next week on the last week instead of dropping it', () => {
    const far = order(1, '2026-10-06T13:00:00-03:00');

    const [, proxima] = build([far]);

    expect(proxima.count).toBe(1);
    expect(proxima.days.some((d) => d.orders.some((o) => o.id === 1))).toBe(true);
  });

  it('shows the range with the month of each end when the week crosses months', () => {
    const [, proxima] = build([]);
    expect(proxima.rangeLabel).toBe('28 sep – 2 oct');
  });
});

describe('weekKeyOfOrder', () => {
  it('tells which week an order belongs to, by its Buenos Aires day', () => {
    expect(weekKeyOfOrder(order(1, '2026-09-25T13:00:00-03:00'), NOW)).toBe('esta');
    expect(weekKeyOfOrder(order(2, '2026-09-28T13:00:00-03:00'), NOW)).toBe('proxima');
    // Domingo 27 a las 23:30 en Buenos Aires (lunes 28 02:30Z): sigue siendo esta semana.
    expect(weekKeyOfOrder(order(3, '2026-09-28T02:30:00Z'), NOW)).toBe('esta');
  });
});
