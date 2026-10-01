import { describe, expect, it } from 'vitest';
import {
  addDays,
  conceptOf,
  donutSlices,
  formatPaymentDate,
  kindShares,
  quickRange,
  todayIn,
  type PaymentRow,
} from './paymentsReport';

const TZ = 'America/Argentina/Buenos_Aires';

describe('todayIn', () => {
  it('reads the calendar day in the restaurant timezone, not UTC', () => {
    // 02:00 UTC on Oct 2nd is still Oct 1st at 23:00 in Buenos Aires (UTC-3).
    expect(todayIn(TZ, new Date('2026-10-02T02:00:00Z'))).toBe('2026-10-01');
    expect(todayIn(TZ, new Date('2026-10-02T04:00:00Z'))).toBe('2026-10-02');
  });
});

describe('addDays', () => {
  it('crosses month and year boundaries', () => {
    expect(addDays('2026-10-01', -6)).toBe('2026-09-25');
    expect(addDays('2026-01-02', -3)).toBe('2025-12-30');
    expect(addDays('2026-02-27', 2)).toBe('2026-03-01');
  });
});

describe('quickRange', () => {
  it('builds inclusive ranges ending today', () => {
    expect(quickRange('today', '2026-10-01')).toEqual({ from: '2026-10-01', to: '2026-10-01' });
    expect(quickRange('7d', '2026-10-01')).toEqual({ from: '2026-09-25', to: '2026-10-01' });
    expect(quickRange('30d', '2026-10-01')).toEqual({ from: '2026-09-02', to: '2026-10-01' });
  });
});

describe('formatPaymentDate', () => {
  it('formats date and time in the restaurant timezone', () => {
    expect(formatPaymentDate('2026-09-08T16:05:00Z', TZ)).toEqual({ date: '08/09/2026', time: '13:05' });
    expect(formatPaymentDate('2026-09-09T02:30:00Z', TZ)).toEqual({ date: '08/09/2026', time: '23:30' });
  });
});

describe('conceptOf', () => {
  const base: PaymentRow = {
    purchaseId: 'p1',
    occurredAt: '2026-09-08T16:05:00Z',
    customer: 'Ana',
    kind: 'INDIVIDUAL',
    packName: 'Sueltos',
    orderId: null,
    credits: 1,
    amountCents: 1000,
    status: 'APPROVED',
    mpPaymentId: '1',
    feeCents: 50,
    netCents: 950,
    creditsReversed: 0,
  };
  it('labels pack kinds with the pack name and direct payments with the order', () => {
    expect(conceptOf(base)).toBe('Individual · Sueltos');
    expect(conceptOf({ ...base, kind: 'SUGERIDO', packName: 'Semana' })).toBe('Sugerido · Semana');
    expect(conceptOf({ ...base, kind: 'OTRO', packName: 'Mes' })).toBe('Otro · Mes');
    expect(conceptOf({ ...base, kind: 'DIRECT', packName: null, orderId: 12 })).toBe('Pago directo · pedido N°12');
  });
  it('omits a missing pack name', () => {
    expect(conceptOf({ ...base, packName: null })).toBe('Individual');
  });
});

describe('kindShares', () => {
  it('keeps the kinds in order with rounded percentages of the count', () => {
    const shares = kindShares([
      { kind: 'INDIVIDUAL', count: 1, grossCents: 100 },
      { kind: 'SUGERIDO', count: 2, grossCents: 200 },
      { kind: 'OTRO', count: 0, grossCents: 0 },
      { kind: 'DIRECT', count: 1, grossCents: 100 },
    ]);
    expect(shares.map((s) => [s.label, s.count, s.percent])).toEqual([
      ['Individual', 1, 25],
      ['Sugerido', 2, 50],
      ['Otro', 0, 0],
      ['Pago directo', 1, 25],
    ]);
  });
  it('gives 0% to everything when there are no payments', () => {
    expect(kindShares([{ kind: 'DIRECT', count: 0, grossCents: 0 }])[0].percent).toBe(0);
  });
});

describe('donutSlices', () => {
  const geo = { cx: 100, cy: 100, outer: 80, inner: 50 };
  it('skips empty values and returns one path per non-empty slice', () => {
    const slices = donutSlices([2, 0, 2], geo);
    expect(slices.map((s) => s.index)).toEqual([0, 2]);
    expect(slices[0].d).toMatch(/^M/);
  });
  it('starts at 12 o’clock: the first slice begins at the top of the outer ring', () => {
    const [first] = donutSlices([1, 1], geo);
    expect(first.d.startsWith('M100 20')).toBe(true);
  });
  it('draws a single 100% slice as a full ring', () => {
    const slices = donutSlices([5], geo);
    expect(slices).toHaveLength(1);
    expect(slices[0].d).not.toContain('NaN');
  });
  it('returns nothing when all values are zero', () => {
    expect(donutSlices([0, 0], geo)).toEqual([]);
  });
});
