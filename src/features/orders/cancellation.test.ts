import { describe, expect, it } from 'vitest';
import {
  cancelOutcomeLabel,
  isRefundable,
  lateCancelCopy,
  refundDeadlineLabel,
  refundWindowLine,
} from './cancellation';
import type { OrderV2 } from './services/ordersApi';

// 13:00 pickup in Buenos Aires (UTC-3) with a 20 minute window -> refundable until 12:40 BA (15:40Z).
const order: OrderV2 = {
  id: 1,
  fecha: '2026-10-28',
  pickupAt: '2026-10-28T16:00:00Z',
  refundableUntil: '2026-10-28T15:40:00Z',
  cancelRefunded: null,
  estado: 'PENDIENTE',
  creditTotal: 2,
  notas: null,
  items: [],
  cancellable: true,
  modifiable: true,
  pickupTimeChangeable: true,
  paidWithMercadoPago: false,
  creditsFromBalance: 0,
};

const before = new Date('2026-10-28T15:39:59Z');
const after = new Date('2026-10-28T15:40:00Z');

describe('isRefundable', () => {
  it('is true strictly before refundableUntil and false from that instant on', () => {
    expect(isRefundable(order, before)).toBe(true);
    expect(isRefundable(order, after)).toBe(false);
  });

  it('treats an order without refundableUntil as refundable (older payloads)', () => {
    expect(isRefundable({ ...order, refundableUntil: undefined }, after)).toBe(true);
  });

  it('never marks an order awaiting payment as late: nothing was consumed', () => {
    expect(isRefundable({ ...order, estado: 'PENDIENTE_PAGO' }, after)).toBe(true);
  });
});

describe('refundDeadlineLabel', () => {
  it('formats the deadline in restaurant time', () => {
    expect(refundDeadlineLabel(order)).toBe('12:40');
  });
});

describe('refundWindowLine', () => {
  it('announces the deadline while refundable', () => {
    expect(refundWindowLine(order, before)).toBe('Con devolución hasta las 12:40');
  });

  it('announces when the refund stopped applying', () => {
    expect(refundWindowLine(order, after)).toBe('Sin devolución desde las 12:40');
  });

  it('is absent for orders that cannot be cancelled, are awaiting payment or are cancelled', () => {
    expect(refundWindowLine({ ...order, cancellable: false }, before)).toBeNull();
    expect(refundWindowLine({ ...order, estado: 'PENDIENTE_PAGO' }, before)).toBeNull();
    expect(refundWindowLine({ ...order, estado: 'CANCELADO' }, before)).toBeNull();
  });

  it('is absent when the payload carries no deadline', () => {
    expect(refundWindowLine({ ...order, refundableUntil: undefined }, before)).toBeNull();
  });
});

describe('cancelOutcomeLabel', () => {
  it('says the lunch came back when it was refunded', () => {
    expect(cancelOutcomeLabel({ ...order, creditTotal: 1, cancelRefunded: true })).toBe('Almuerzo devuelto');
    expect(cancelOutcomeLabel({ ...order, cancelRefunded: true })).toBe('2 almuerzos devueltos');
  });

  it('says how many lunches were consumed on a late cancellation', () => {
    expect(cancelOutcomeLabel({ ...order, creditTotal: 1, cancelRefunded: false })).toBe('1 almuerzo consumido');
    expect(cancelOutcomeLabel({ ...order, cancelRefunded: false })).toBe('2 almuerzos consumidos');
  });

  it('has no outcome when the backend does not say', () => {
    expect(cancelOutcomeLabel({ ...order, cancelRefunded: null })).toBeNull();
    expect(cancelOutcomeLabel({ ...order, cancelRefunded: undefined })).toBeNull();
  });
});

describe('lateCancelCopy', () => {
  it('uses the plural form with the credit total', () => {
    expect(lateCancelCopy(2)).toEqual({ notRefunded: 'Tus 2 almuerzos no se devuelven', charged: 'se cobran' });
  });

  it('uses the singular form for one lunch', () => {
    expect(lateCancelCopy(1)).toEqual({ notRefunded: 'Este almuerzo no se devuelve', charged: 'se cobra' });
  });
});
