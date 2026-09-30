import { describe, expect, it } from 'vitest';
import { buildPendingItem } from './pendingPurchaseModel';
import type { CreditPurchase } from './types';

// 12:00 en Buenos Aires (UTC-3).
const NOW = new Date('2026-09-29T15:00:00Z');

const pack: CreditPurchase = {
  id: 'p1',
  type: 'PACK',
  creditAmount: 5,
  amountCents: 700000,
  currency: 'ARS',
  status: 'PENDING',
  createdAt: '2026-09-29T14:52:00Z',
  creditedAt: null,
  reversedAt: null,
  packNombre: 'Paquete Semana',
  orderId: null,
  orderEstado: null,
};
const direct: CreditPurchase = { ...pack, id: 'd1', type: 'DIRECT', creditAmount: 1, packNombre: null, orderId: 42, orderEstado: 'PENDIENTE_PAGO' };

const started = (createdAt: string) => buildPendingItem({ ...pack, createdAt }, { now: NOW }).sub;

describe('buildPendingItem — started label', () => {
  it('says "hoy" for the same restaurant day', () => {
    expect(started('2026-09-29T03:30:00Z')).toContain('iniciado hoy 00:30');
  });

  it('says "ayer" for the previous restaurant day', () => {
    expect(started('2026-09-28T20:30:00Z')).toContain('iniciado ayer 17:30');
  });

  it('uses the restaurant day, not UTC, at the midnight boundary', () => {
    // 02:59Z del 29 sigue siendo el 28 en Buenos Aires.
    expect(started('2026-09-29T02:59:00Z')).toContain('iniciado ayer 23:59');
  });

  it('uses a real date for anything older than yesterday', () => {
    expect(started('2026-09-27T15:10:00Z')).toContain('iniciado el 27/09 12:10');
    expect(started('2026-09-27T15:10:00Z')).not.toContain('ayer');
  });

  it('uses a real date for a purchase two days back at the boundary', () => {
    expect(started('2026-09-28T02:59:00Z')).toContain('iniciado el 27/09 23:59');
  });
});

describe('buildPendingItem — DIRECT note', () => {
  it('uses the singular for one lunch', () => {
    const item = buildPendingItem(direct, { now: NOW });

    expect(item.note).toBe('Apenas Mercado Pago confirme el pago, el almuerzo se acredita y queda reservado para este pedido.');
  });

  it('uses the singular for one lunch on a cancelled order', () => {
    const item = buildPendingItem({ ...direct, orderEstado: 'CANCELADO' }, { now: NOW });

    expect(item.note).toBe(
      'Este pedido se canceló. Cuando Mercado Pago confirme el pago, el almuerzo se acredita en tu saldo para que lo uses cuando quieras.',
    );
  });

  it('uses the plural for several lunches', () => {
    const item = buildPendingItem({ ...direct, creditAmount: 3 }, { now: NOW });

    expect(item.note).toContain('los 3 almuerzos se acreditan y quedan reservados');
  });
});
