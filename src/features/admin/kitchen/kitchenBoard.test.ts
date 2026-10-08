import { describe, expect, it } from 'vitest';
import type { PickupOrder } from '@/features/admin/services/adminApi';
import { buildKitchenBoard, formatMinute, minuteOfDay, slotAnchorFor, type BoardContext } from './kitchenBoard';

const TZ = 'America/Argentina/Buenos_Aires'; // UTC-3, no DST

/** Local HH:MM in Buenos Aires -> ISO instant for 2026-10-01. */
function at(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(Date.UTC(2026, 9, 1, h + 3, m)).toISOString();
}

function order(id: number, estado: PickupOrder['estado'], pickup: string, extra: Partial<PickupOrder> = {}): PickupOrder {
  return {
    id,
    customerNickname: `cliente${id}`,
    items: [{ dishNombre: 'Milanesa', sideNombre: 'Papas', creditCost: 1, notas: null }],
    notas: null,
    estado,
    pickupAt: at(pickup),
    comandadoAt: null,
    deliveredAt: null,
    ...extra,
  };
}

function ctx(now: string, over: Partial<BoardContext> = {}): BoardContext {
  return {
    now: new Date(at(now)),
    timezone: TZ,
    leadMinutes: 20,
    slotMinutes: 10,
    slotAnchorMinutes: 11 * 60, // window opens 11:00
    ...over,
  };
}

describe('minuteOfDay / formatMinute', () => {
  it('reads the minute of the day in the restaurant timezone, not the browser one', () => {
    expect(minuteOfDay(at('12:07'), TZ)).toBe(12 * 60 + 7);
    expect(formatMinute(12 * 60 + 7)).toBe('12:07');
    expect(formatMinute(9 * 60)).toBe('09:00');
  });
});

describe('confirmed columns', () => {
  it('has no columns when there are no confirmed orders, whatever the lead and slot size', () => {
    expect(buildKitchenBoard([], ctx('12:03')).confirmed).toEqual([]);
    expect(buildKitchenBoard([], ctx('12:03', { leadMinutes: 30 })).confirmed).toEqual([]);
    expect(buildKitchenBoard([], ctx('12:10', { slotMinutes: 15, slotAnchorMinutes: 11 * 60 + 5 })).confirmed).toEqual([]);
  });

  it('shows only the slots that have orders, skipping the empty ones in the window', () => {
    const board = buildKitchenBoard(
      [order(1, 'CONFIRMADO', '12:20'), order(2, 'CONFIRMADO', '12:20')],
      ctx('12:03'),
    );
    // 12:10 is in the window but has no orders: it is not a column.
    expect(board.confirmed.map((c) => [c.time, c.orders.length, c.first])).toEqual([['12:20', 2, true]]);
  });

  it('keeps the slots in time order and marks only the first one', () => {
    const board = buildKitchenBoard(
      [order(1, 'CONFIRMADO', '12:20'), order(2, 'CONFIRMADO', '12:10')],
      ctx('12:03'),
    );
    expect(board.confirmed.map((c) => [c.time, c.first])).toEqual([
      ['12:10', true],
      ['12:20', false],
    ]);
  });

  it('keeps an overdue slot with orders, first, and drops the empty slots around it', () => {
    const board = buildKitchenBoard(
      [order(1, 'CONFIRMADO', '12:00'), order(2, 'CONFIRMADO', '12:10')],
      ctx('12:07'),
    );
    expect(board.confirmed.map((c) => [c.time, c.overdue, c.first, c.rel])).toEqual([
      ['12:00', true, true, 'atrasado 7 min'],
      ['12:10', false, false, 'en 3 min'],
    ]);
  });

  it('keeps a slot with orders that is beyond the lead window', () => {
    const board = buildKitchenBoard([order(1, 'CONFIRMADO', '12:50')], ctx('12:03'));
    expect(board.confirmed.map((c) => [c.time, c.overdue, c.rel])).toEqual([['12:50', false, 'en 47 min']]);
  });

  it('labels a slot that is exactly now', () => {
    const board = buildKitchenBoard([order(1, 'CONFIRMADO', '12:10')], ctx('12:10'));
    expect(board.confirmed[0]).toMatchObject({ time: '12:10', overdue: false, rel: 'retiran ahora' });
  });

  it('ignores orders in other states', () => {
    const board = buildKitchenBoard(
      [order(1, 'PENDIENTE', '12:10'), order(2, 'COMANDADO', '12:10'), order(3, 'ENTREGADO', '12:10')],
      ctx('12:03'),
    );
    expect(board.confirmed).toEqual([]);
  });
});

describe('commanded', () => {
  it('sorts by pickup time and folds those picked up more than 30 min ago', () => {
    const board = buildKitchenBoard(
      [
        order(1, 'COMANDADO', '12:40'),
        order(2, 'COMANDADO', '11:20'),
        order(3, 'COMANDADO', '12:20'),
        order(4, 'COMANDADO', '11:35'),
      ],
      ctx('12:05'),
    );
    expect(board.commanded.fresh.map((o) => o.id)).toEqual([4, 3, 1]);
    expect(board.commanded.stale.map((o) => o.id)).toEqual([2]);
    // exactly 30 min ago is still fresh
    expect(board.commanded.fresh[0].pickupLabel).toBe('11:35');
  });

  it('keeps an order that was picked up exactly 30 min ago in the fresh list', () => {
    const board = buildKitchenBoard([order(1, 'COMANDADO', '11:35')], ctx('12:05'));
    expect(board.commanded.fresh).toHaveLength(1);
    expect(board.commanded.stale).toHaveLength(0);
  });

  it('describes the pickup relative to now', () => {
    const board = buildKitchenBoard(
      [order(1, 'COMANDADO', '12:15'), order(2, 'COMANDADO', '11:55'), order(3, 'COMANDADO', '12:05')],
      ctx('12:05'),
    );
    expect(board.commanded.fresh.map((o) => o.rel)).toEqual(['hace 10 min', 'ahora', 'en 10 min']);
  });
});

describe('scheduled', () => {
  it('sorts PENDIENTE earliest first and computes when each one confirms', () => {
    const board = buildKitchenBoard(
      [order(1, 'PENDIENTE', '14:00'), order(2, 'PENDIENTE', '13:10')],
      ctx('12:03'),
    );
    expect(board.scheduled.map((o) => [o.id, o.pickupLabel, o.confirmAtLabel])).toEqual([
      [2, '13:10', '12:50'],
      [1, '14:00', '13:40'],
    ]);
  });
});

describe('delivered', () => {
  it('lists ENTREGADO orders by pickup time with their delivery time', () => {
    const board = buildKitchenBoard(
      [
        order(1, 'ENTREGADO', '12:20', { deliveredAt: at('12:25') }),
        order(2, 'ENTREGADO', '11:50', { deliveredAt: at('11:58') }),
      ],
      ctx('12:30'),
    );
    expect(board.delivered.map((o) => [o.id, o.pickupLabel, o.deliveredLabel])).toEqual([
      [2, '11:50', '11:58'],
      [1, '12:20', '12:25'],
    ]);
  });
});

describe('slotAnchorFor', () => {
  const schedule = [
    { dayOfWeek: 3, open: true, windowStart: '11:30', windowEnd: '22:00' },
    { dayOfWeek: 4, open: true, windowStart: '12:05', windowEnd: '23:00' }, // 2026-10-01 is a Thursday
  ];

  it('uses the window start of today, weekday read in the restaurant timezone', () => {
    // 01:30 UTC on Friday is still Thursday evening in Buenos Aires
    const now = new Date(Date.UTC(2026, 9, 2, 1, 30));
    expect(slotAnchorFor(schedule, now, TZ)).toBe(12 * 60 + 5);
  });

  it('falls back to midnight when today has no open window', () => {
    const closed = [{ dayOfWeek: 4, open: false, windowStart: null, windowEnd: null }];
    expect(slotAnchorFor(closed, new Date(at('12:00')), TZ)).toBe(0);
    expect(slotAnchorFor(undefined, new Date(at('12:00')), TZ)).toBe(0);
  });
});
