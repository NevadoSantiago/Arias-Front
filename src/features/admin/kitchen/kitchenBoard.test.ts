import { describe, expect, it } from 'vitest';
import type { PickupOrder } from '@/features/admin/services/adminApi';
import {
  buildKitchenBoard,
  countdownTone,
  formatCountdown,
  formatMinute,
  minuteOfDay,
  ticketLines,
  worstPrintStatus,
  type BoardContext,
} from './kitchenBoard';

const TZ = 'America/Argentina/Buenos_Aires'; // UTC-3, no DST
const MIN = 60_000;

/** Local HH:MM[:SS] in Buenos Aires -> epoch ms for 2026-10-01. */
function ms(hhmmss: string): number {
  const [h, m, s = 0] = hhmmss.split(':').map(Number);
  return Date.UTC(2026, 9, 1, h + 3, m, s);
}
const at = (hhmm: string) => new Date(ms(hhmm)).toISOString();

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
    printStatus: 'NONE',
    printedAt: null,
    ...extra,
  };
}

function ctx(now: string, over: Partial<BoardContext> = {}): BoardContext {
  return { nowMs: ms(now), timezone: TZ, leadMinutes: 60, ...over };
}

describe('minuteOfDay / formatMinute', () => {
  it('reads the minute of the day in the restaurant timezone, not the browser one', () => {
    expect(minuteOfDay(at('12:07'), TZ)).toBe(12 * 60 + 7);
    expect(formatMinute(12 * 60 + 7)).toBe('12:07');
    expect(formatMinute(9 * 60)).toBe('09:00');
  });
});

describe('ticketLines', () => {
  const item = (dishNombre: string, sideNombre: string | null, notas: string | null = null) => ({
    dishNombre,
    sideNombre,
    creditCost: 1,
    notas,
  });

  it('groups equal items like the printed ticket does', () => {
    expect(
      ticketLines([item('Milanesa Napolitana', 'papas fritas'), item('Milanesa Napolitana', 'papas fritas')]),
    ).toEqual([{ qty: 2, dish: 'Milanesa Napolitana', side: 'papas fritas', note: null }]);
  });

  it('keeps different sides or notes apart, in first-seen order', () => {
    expect(
      ticketLines([
        item('Milanesa', 'papas'),
        item('Ensalada César', null),
        item('Milanesa', 'puré'),
        item('Milanesa', 'papas', 'sin sal'),
        item('Milanesa', 'papas'),
      ]),
    ).toEqual([
      { qty: 2, dish: 'Milanesa', side: 'papas', note: null },
      { qty: 1, dish: 'Ensalada César', side: null, note: null },
      { qty: 1, dish: 'Milanesa', side: 'puré', note: null },
      { qty: 1, dish: 'Milanesa', side: 'papas', note: 'sin sal' },
    ]);
  });

  it('treats blank sides and notes as absent', () => {
    expect(ticketLines([item('Flan', '  ', ' ')])).toEqual([{ qty: 1, dish: 'Flan', side: null, note: null }]);
  });
});

describe('countdown', () => {
  it('formats mm:ss and h:mm:ss', () => {
    expect(formatCountdown(7 * MIN + 32_000)).toBe('07:32');
    expect(formatCountdown(0)).toBe('00:00');
    expect(formatCountdown(90 * MIN + 5_000)).toBe('1:30:05');
    expect(formatCountdown(-(7 * MIN + 10_000))).toBe('07:10');
  });

  it('is calm above 10 min, soon up to 10, urgent up to 3 and overdue at zero', () => {
    expect(countdownTone(10 * MIN + 1)).toBe('calm');
    expect(countdownTone(10 * MIN)).toBe('soon');
    expect(countdownTone(3 * MIN + 1)).toBe('soon');
    expect(countdownTone(3 * MIN)).toBe('urgent');
    expect(countdownTone(1)).toBe('urgent');
    expect(countdownTone(0)).toBe('overdue');
    expect(countdownTone(-5_000)).toBe('overdue');
  });
});

describe('worstPrintStatus', () => {
  it('ranks FAILED > EXPIRED > NONE > QUEUED > PRINTED', () => {
    expect(worstPrintStatus(['PRINTED', 'PRINTED'])).toBe('PRINTED');
    expect(worstPrintStatus(['PRINTED', 'QUEUED'])).toBe('QUEUED');
    expect(worstPrintStatus(['QUEUED', 'NONE'])).toBe('NONE');
    expect(worstPrintStatus(['NONE', 'EXPIRED', 'QUEUED'])).toBe('EXPIRED');
    expect(worstPrintStatus(['EXPIRED', 'FAILED', 'PRINTED'])).toBe('FAILED');
  });
});

describe('commanded groups', () => {
  const now = '12:00:30';

  it('has one group per occupied pickup minute, in time order, and no empty ones', () => {
    const board = buildKitchenBoard(
      [
        order(3, 'COMANDADO', '12:34'),
        order(1, 'COMANDADO', '12:20'),
        order(2, 'COMANDADO', '12:34'),
      ],
      ctx(now),
    );
    expect(board.groups.map((g) => [g.time, g.orders.map((o) => o.id)])).toEqual([
      ['12:20', [1]],
      ['12:34', [2, 3]],
    ]);
  });

  it('counts down to the pickup minute and picks the tone', () => {
    const board = buildKitchenBoard(
      [order(1, 'COMANDADO', '12:02'), order(2, 'COMANDADO', '12:09'), order(3, 'COMANDADO', '12:34')],
      ctx(now),
    );
    const [g1, g2, g3] = board.groups;
    expect(g1.msUntil).toBe(90_000);
    expect(g1.tone).toBe('urgent');
    expect(g2.msUntil).toBe(8 * MIN + 30_000);
    expect(g2.tone).toBe('soon');
    expect(g3.msUntil).toBe(33 * MIN + 30_000);
    expect(g3.tone).toBe('calm');
  });

  it('moves orders whose pickup minute passed to overdue, oldest first, with how late they are', () => {
    const board = buildKitchenBoard(
      [
        order(1, 'COMANDADO', '11:55'),
        order(2, 'COMANDADO', '11:50'),
        order(3, 'COMANDADO', '12:00'),
        order(4, 'COMANDADO', '12:01'),
      ],
      ctx(now),
    );
    expect(board.overdue.map((o) => [o.id, o.overdueMs])).toEqual([
      [2, 10 * MIN + 30_000],
      [1, 5 * MIN + 30_000],
      [3, 30_000],
    ]);
    expect(board.groups.map((g) => g.time)).toEqual(['12:01']);
  });

  it('labels each order with its pickup time and ticket lines', () => {
    const board = buildKitchenBoard([order(1, 'COMANDADO', '12:34')], ctx(now));
    const o = board.groups[0].orders[0];
    expect(o.pickupLabel).toBe('12:34');
    expect(o.lines).toEqual([{ qty: 1, dish: 'Milanesa', side: 'Papas', note: null }]);
  });

  it('gives each group the worst print status of its orders', () => {
    const board = buildKitchenBoard(
      [
        order(1, 'COMANDADO', '12:34', { printStatus: 'PRINTED' }),
        order(2, 'COMANDADO', '12:34', { printStatus: 'FAILED' }),
        order(3, 'COMANDADO', '12:40', { printStatus: 'PRINTED' }),
      ],
      ctx(now),
    );
    expect(board.groups.map((g) => g.worst)).toEqual(['FAILED', 'PRINTED']);
  });

  it('ignores orders in other states', () => {
    const board = buildKitchenBoard([order(1, 'PENDIENTE', '12:34'), order(2, 'ENTREGADO', '12:34')], ctx(now));
    expect(board.groups).toEqual([]);
    expect(board.overdue).toEqual([]);
  });
});

describe('timeline', () => {
  it('has one marker per occupied minute within the next 60 minutes, at its offset', () => {
    const board = buildKitchenBoard(
      [
        order(1, 'COMANDADO', '12:15'),
        order(2, 'COMANDADO', '12:15', { printStatus: 'QUEUED' }),
        order(3, 'COMANDADO', '12:30'),
        order(4, 'COMANDADO', '13:20'), // beyond the hour
        order(5, 'COMANDADO', '11:50'), // overdue
      ],
      ctx('12:00:00'),
    );
    expect(board.timeline.markers.map((m) => [m.time, m.offset, m.count, m.worst])).toEqual([
      ['12:15', 0.25, 2, 'NONE'],
      ['12:30', 0.5, 1, 'NONE'],
    ]);
    expect(board.timeline.markers[0].key).toBe(board.groups[0].key);
  });

  it('includes a pickup exactly 60 minutes away and labels both ends', () => {
    const board = buildKitchenBoard([order(1, 'COMANDADO', '13:00')], ctx('12:00:00'));
    expect(board.timeline.markers.map((m) => m.offset)).toEqual([1]);
    expect(board.timeline.nowLabel).toBe('12:00');
    expect(board.timeline.endLabel).toBe('13:00');
  });

  it('ticks every 10 minutes from now', () => {
    const board = buildKitchenBoard([], ctx('12:05:00'));
    expect(board.timeline.ticks.map((t) => [t.label, t.offset])).toEqual([
      ['12:05', 0],
      ['12:15', 1 / 6],
      ['12:25', 2 / 6],
      ['12:35', 3 / 6],
      ['12:45', 4 / 6],
      ['12:55', 5 / 6],
      ['13:05', 1],
    ]);
  });
});

describe('scheduled', () => {
  it('lists PENDIENTE and the legacy CONFIRMADO by pickup time with when each gets commanded', () => {
    const board = buildKitchenBoard(
      [order(9, 'PENDIENTE', '14:10'), order(8, 'CONFIRMADO', '13:00'), order(7, 'PENDIENTE', '13:40')],
      ctx('12:00:00'),
    );
    expect(board.scheduled.map((o) => [o.id, o.pickupLabel, o.comandarAtLabel])).toEqual([
      [8, '13:00', '12:00'],
      [7, '13:40', '12:40'],
      [9, '14:10', '13:10'],
    ]);
  });

  it('computes how long until each one is commanded', () => {
    const board = buildKitchenBoard([order(7, 'PENDIENTE', '13:40')], ctx('12:10:00'));
    expect(board.scheduled[0].comandarInMs).toBe(30 * MIN);
  });

  it('follows the configured lead time', () => {
    const board = buildKitchenBoard([order(7, 'PENDIENTE', '13:40')], ctx('12:00:00', { leadMinutes: 45 }));
    expect(board.scheduled[0].comandarAtLabel).toBe('12:55');
  });
});

describe('delivered', () => {
  it('lists ENTREGADO orders by pickup time with their delivery time', () => {
    const board = buildKitchenBoard(
      [
        order(2, 'ENTREGADO', '12:30', { deliveredAt: at('12:31') }),
        order(1, 'ENTREGADO', '12:10', { deliveredAt: at('12:12') }),
      ],
      ctx('12:40'),
    );
    expect(board.delivered.map((o) => [o.id, o.pickupLabel, o.deliveredLabel])).toEqual([
      [1, '12:10', '12:12'],
      [2, '12:30', '12:31'],
    ]);
  });
});
