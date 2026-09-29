import { describe, expect, it } from 'vitest';
import { comandaFooter, comandaItems, formatComandaWhen, isPaidWithMercadoPago, lowerFirst } from './comandaModel';
import type { OrderV2 } from '../../services/ordersApi';

const NOW = new Date('2026-09-24T12:00:00Z');
const FUTURE = '2026-09-24T16:00:00Z';
const PAST = '2026-09-22T16:00:00Z';

function order(overrides: Partial<OrderV2> = {}): OrderV2 {
  return {
    id: 142,
    fecha: '2026-09-24',
    pickupAt: FUTURE,
    estado: 'PENDIENTE',
    creditTotal: 2,
    notas: null,
    items: [
      { id: 1, dishId: 10, dishNombre: 'Milanesa napolitana', dishCategoria: 'Básico', sideId: 5, sideNombre: 'Papas Fritas', creditCost: 1, notas: 'Sin sal, por favor' },
      { id: 2, dishId: 11, dishNombre: 'Ensalada César', dishCategoria: 'Básico', sideId: null, sideNombre: null, creditCost: 1, notas: null },
    ],
    cancellable: true,
    modifiable: true,
    pickupTimeChangeable: true,
    paidWithMercadoPago: false,
    creditsFromBalance: 0,
    ...overrides,
  };
}

describe('isPaidWithMercadoPago', () => {
  it('is true only when the order has a DIRECT purchase and is not awaiting payment', () => {
    expect(isPaidWithMercadoPago(order({ paidWithMercadoPago: true, estado: 'CONFIRMADO' }))).toBe(true);
    expect(isPaidWithMercadoPago(order({ paidWithMercadoPago: true, estado: 'PENDIENTE_PAGO' }))).toBe(false);
    expect(isPaidWithMercadoPago(order({ paidWithMercadoPago: false, estado: 'CONFIRMADO' }))).toBe(false);
  });
});

describe('comandaItems', () => {
  it('maps dish, side ("c/ …" in lower case), note and lunch cost', () => {
    expect(comandaItems(order())).toEqual([
      { name: 'Milanesa napolitana', side: 'c/ papas fritas', note: 'Sin sal, por favor', costLabel: '1 almuerzo', isNew: false },
      { name: 'Ensalada César', side: null, note: null, costLabel: '1 almuerzo', isNew: false },
    ]);
  });

  it('marks the given item ids as new', () => {
    const items = comandaItems(order(), { newItemIds: new Set([2]) });

    expect(items.map((i) => i.isNew)).toEqual([false, true]);
  });

  it('shows the price placeholder instead of lunches for an order paid with, or awaiting, Mercado Pago', () => {
    const paid = comandaItems(order({ estado: 'CONFIRMADO', paidWithMercadoPago: true }));
    const awaiting = comandaItems(order({ estado: 'PENDIENTE_PAGO', paidWithMercadoPago: true }));

    expect(paid.every((i) => i.costLabel === '$ [PRECIO]')).toBe(true);
    expect(awaiting.every((i) => i.costLabel === '$ [PRECIO]')).toBe(true);
  });
});

describe('comandaFooter', () => {
  it('lunch-paid upcoming order: reserved lunches and what is left', () => {
    expect(comandaFooter(order(), { now: NOW, walletAvailable: 10 })).toEqual({
      label: 'Reservaste 2 almuerzos para este pedido',
      value: 'Te quedan 10 almuerzos',
      icon: 'lunches',
    });
  });

  it('for platos added to an order, says how many lunches were reserved on top', () => {
    expect(comandaFooter(order(), { now: NOW, walletAvailable: 8, addedLunches: 1 })).toEqual({
      label: 'Reservaste 1 almuerzo más para este pedido',
      value: 'Te quedan 8 almuerzos',
      icon: 'lunches',
    });
  });

  it('an order just placed always reads as reserved, whatever the clock says', () => {
    expect(comandaFooter(order({ pickupAt: PAST }), { now: NOW, walletAvailable: 10, justPlaced: true }).label).toBe(
      'Reservaste 2 almuerzos para este pedido',
    );
  });

  it('omits "Te quedan" while the wallet is unknown', () => {
    expect(comandaFooter(order(), { now: NOW, walletAvailable: null }).value).toBeNull();
  });

  it('lunch-paid past order: "Pagado con almuerzos"', () => {
    expect(comandaFooter(order({ pickupAt: PAST, estado: 'CONFIRMADO' }), { now: NOW, walletAvailable: 10 })).toEqual({
      label: 'Pagado con almuerzos',
      value: '2 almuerzos',
      icon: 'lunches',
    });
  });

  it('paid with Mercado Pago: label plus the visible price placeholder', () => {
    expect(
      comandaFooter(order({ estado: 'CONFIRMADO', paidWithMercadoPago: true }), { now: NOW, walletAvailable: 10 }),
    ).toEqual({ label: 'Pagado con Mercado Pago', value: '$ [PRECIO]', icon: 'card' });
  });

  it('awaiting payment: "A pagar con Mercado Pago" even though a DIRECT purchase exists', () => {
    expect(
      comandaFooter(order({ estado: 'PENDIENTE_PAGO', paidWithMercadoPago: true }), { now: NOW, walletAvailable: 10 }),
    ).toEqual({ label: 'A pagar con Mercado Pago', value: '$ [PRECIO]', icon: 'card' });
  });

  it('cancelled lunch-paid order: the lunches went back to the balance', () => {
    expect(comandaFooter(order({ estado: 'CANCELADO' }), { now: NOW, walletAvailable: 10 })).toEqual({
      label: 'Pedido cancelado',
      value: '2 almuerzos devueltos a tu saldo',
      icon: 'lunches',
    });
    expect(comandaFooter(order({ estado: 'CANCELADO', creditTotal: 1 }), { now: NOW, walletAvailable: null }).value).toBe(
      '1 almuerzo devuelto a tu saldo',
    );
  });

  it('cancelled Mercado Pago order: no claim about the balance', () => {
    expect(
      comandaFooter(order({ estado: 'CANCELADO', paidWithMercadoPago: true }), { now: NOW, walletAvailable: 10 }),
    ).toEqual({ label: 'Pedido cancelado', value: null, icon: 'card' });
  });

  it('never says "créditos"', () => {
    const texts = [order(), order({ estado: 'CANCELADO' }), order({ pickupAt: PAST })].flatMap((o) => {
      const f = comandaFooter(o, { now: NOW, walletAvailable: 3 });
      return [f.label, f.value ?? ''];
    });

    expect(texts.join(' ')).not.toMatch(/crédito/i);
  });
});

describe('formatComandaWhen / lowerFirst', () => {
  it('lowers only the first letter', () => {
    expect(lowerFirst('Jueves 24 de Septiembre')).toBe('jueves 24 de Septiembre');
    expect(lowerFirst('')).toBe('');
  });

  it('prefixes "Hoy, " (with the day in lower case) only for today', () => {
    expect(formatComandaWhen({ dateLabel: 'Jueves 24 de septiembre', isToday: true, timeLabel: '13:00' })).toBe(
      'Hoy, jueves 24 de septiembre · 13:00 hs',
    );
    expect(formatComandaWhen({ dateLabel: 'Viernes 25 de septiembre', isToday: false, timeLabel: '13:00' })).toBe(
      'Viernes 25 de septiembre · 13:00 hs',
    );
  });
});
