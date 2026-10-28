import { describe, expect, it } from 'vitest';
import type { CancelledOrder } from '@/features/admin/services/adminApi';
import { cancelledSummary, newCommandedCancellations } from './cancelledOrders';

const cancelled = (id: number, extra: Partial<CancelledOrder> = {}): CancelledOrder => ({
  id,
  customerNickname: `alias${id}`,
  items: [],
  notas: null,
  pickupAt: '2026-10-28T16:00:00Z',
  comandadoAt: null,
  cancelledAt: '2026-10-28T15:00:00Z',
  cancelRefunded: true,
  cancelReason: 'CUSTOMER',
  ...extra,
});

describe('newCommandedCancellations', () => {
  it('returns only unseen orders that were already commanded when they were cancelled', () => {
    const list = [
      cancelled(3, { comandadoAt: '2026-10-28T15:30:00Z' }),
      cancelled(2),
      cancelled(1, { comandadoAt: '2026-10-28T15:00:00Z' }),
    ];

    expect(newCommandedCancellations(new Set([1]), list).map((o) => o.id)).toEqual([3]);
  });

  it('returns nothing when everything was already seen', () => {
    expect(newCommandedCancellations(new Set([1]), [cancelled(1, { comandadoAt: '2026-10-28T15:00:00Z' })])).toEqual([]);
  });
});

describe('cancelledSummary', () => {
  it('counts the cancelled orders that were already commanded', () => {
    const list = [cancelled(1, { comandadoAt: '2026-10-28T15:00:00Z' }), cancelled(2)];

    expect(cancelledSummary(list)).toEqual({ total: 2, commanded: 1, commandedLabel: '1 ya comandado' });
  });

  it('pluralizes the chip and has none without commanded orders', () => {
    const two = [cancelled(1, { comandadoAt: 'x' }), cancelled(2, { comandadoAt: 'y' })];

    expect(cancelledSummary(two).commandedLabel).toBe('2 ya comandados');
    expect(cancelledSummary([cancelled(3)]).commandedLabel).toBeNull();
  });
});
