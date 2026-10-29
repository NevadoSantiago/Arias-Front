import { describe, expect, it } from 'vitest';
import type { PickupOrder } from '@/features/admin/services/adminApi';
import { buildKitchenBoard } from './kitchenBoard';
import {
  countedOrders,
  filterByRange,
  pickupTimes,
  rangeFromNow,
  resolveRange,
  setRangeFrom,
  setRangeTo,
  WHOLE_DAY,
} from './todayDishes';

const TZ = 'America/Argentina/Buenos_Aires';

/** Local HH:MM[:SS] in Buenos Aires -> epoch ms for 2026-10-01. */
function ms(hhmmss: string): number {
  const [h, m, s = 0] = hhmmss.split(':').map(Number);
  return Date.UTC(2026, 9, 1, h + 3, m, s);
}
const at = (hhmm: string) => new Date(ms(hhmm)).toISOString();

function order(id: number, estado: PickupOrder['estado'], pickup: string): PickupOrder {
  return {
    id,
    customerNickname: `cliente${id}`,
    items: [{ dishNombre: 'Milanesa', sideNombre: null, creditCost: 1, notas: null }],
    notas: null,
    estado,
    pickupAt: at(pickup),
    comandadoAt: null,
    deliveredAt: null,
    printStatus: 'NONE',
    printedAt: null,
  };
}

const boardOf = (orders: PickupOrder[], now = '12:26:28') =>
  buildKitchenBoard(orders, { nowMs: ms(now), timezone: TZ, leadMinutes: 60 });

describe('countedOrders', () => {
  it('takes scheduled and every commanded order (upcoming and overdue), never delivered ones, sorted by pickup', () => {
    const board = boardOf([
      order(1, 'ENTREGADO', '12:00'),
      order(2, 'COMANDADO', '12:10'), // overdue at 12:26
      order(3, 'COMANDADO', '12:40'), // upcoming group
      order(4, 'CONFIRMADO', '13:30'),
      order(5, 'PENDIENTE', '12:50'),
    ]);

    expect(countedOrders(board).map((o) => o.id)).toEqual([2, 3, 5, 4]);
  });
});

describe('pickupTimes', () => {
  it('lists each pickup minute once, sorted, with its HH:MM label', () => {
    const board = boardOf([order(1, 'PENDIENTE', '13:30'), order(2, 'COMANDADO', '12:40'), order(3, 'CONFIRMADO', '12:40')]);

    expect(pickupTimes(countedOrders(board))).toEqual([
      { ms: ms('12:40'), label: '12:40' },
      { ms: ms('13:30'), label: '13:30' },
    ]);
  });
});

describe('resolveRange', () => {
  const times = [ms('12:00'), ms('12:30'), ms('13:00'), ms('13:30')].map((m) => ({ ms: m, label: '' }));

  it('is the whole day when nothing was narrowed', () => {
    expect(resolveRange(times, WHOLE_DAY)).toEqual({ from: ms('12:00'), to: ms('13:30') });
  });

  it('keeps a selection whose ends are still options', () => {
    expect(resolveRange(times, { from: ms('12:30'), to: ms('13:00') })).toEqual({ from: ms('12:30'), to: ms('13:00') });
  });

  it('clamps ends that vanished inwards to the nearest remaining option', () => {
    expect(resolveRange(times, { from: ms('12:10'), to: ms('13:20') })).toEqual({ from: ms('12:30'), to: ms('13:00') });
  });

  it('falls back to the whole day when the clamped range is empty', () => {
    expect(resolveRange(times, { from: ms('13:40'), to: ms('14:00') })).toEqual({ from: ms('12:00'), to: ms('13:30') });
    expect(resolveRange(times, { from: ms('12:10'), to: ms('12:20') })).toEqual({ from: ms('12:00'), to: ms('13:30') });
  });

  it('is null without options', () => {
    expect(resolveRange([], WHOLE_DAY)).toBeNull();
  });
});

describe('setRangeFrom / setRangeTo', () => {
  it('pushes the other end when the new one would cross it', () => {
    expect(setRangeFrom({ from: 10, to: 20 }, 30)).toEqual({ from: 30, to: 30 });
    expect(setRangeTo({ from: 10, to: 20 }, 5)).toEqual({ from: 5, to: 5 });
  });

  it('leaves the other end alone otherwise', () => {
    expect(setRangeFrom({ from: 10, to: 20 }, 15)).toEqual({ from: 15, to: 20 });
    expect(setRangeTo({ from: 10, to: 20 }, 15)).toEqual({ from: 10, to: 15 });
  });
});

describe('rangeFromNow', () => {
  const times = [ms('12:00'), ms('12:30'), ms('13:30')].map((m) => ({ ms: m, label: '' }));

  it('starts at the first pickup at or after the current minute and ends at the last', () => {
    expect(rangeFromNow(times, ms('12:30:45'))).toEqual({ from: ms('12:30'), to: ms('13:30') });
    expect(rangeFromNow(times, ms('12:31'))).toEqual({ from: ms('13:30'), to: ms('13:30') });
  });

  it('is null when no pickup remains', () => {
    expect(rangeFromNow(times, ms('13:31'))).toBeNull();
  });
});

describe('filterByRange', () => {
  it('keeps the orders whose pickup is inside the inclusive range', () => {
    const board = boardOf([order(1, 'PENDIENTE', '12:30'), order(2, 'PENDIENTE', '13:00'), order(3, 'PENDIENTE', '13:30')]);

    const kept = filterByRange(countedOrders(board), { from: ms('13:00'), to: ms('13:30') });

    expect(kept.map((o) => o.id)).toEqual([2, 3]);
  });
});
