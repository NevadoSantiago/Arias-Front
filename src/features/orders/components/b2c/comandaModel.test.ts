import { describe, expect, it } from 'vitest';
import { comandaCopy, comandaFooter, comandaItems, formatComandaWhen, isPaidWithMercadoPago, lowerFirst } from './comandaModel';
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

  describe('partial balance payment (F23)', () => {
    const partial = { creditsFromBalance: 1, paidWithMercadoPago: true };

    it('paid partly, upcoming: "Reservaste N almuerzo de tu saldo" plus what Mercado Pago charged', () => {
      expect(
        comandaFooter(order({ ...partial, estado: 'PENDIENTE' }), { now: NOW, walletAvailable: 0 }),
      ).toEqual({
        label: 'Reservaste 1 almuerzo de tu saldo',
        value: 'Pagado con Mercado Pago: 1 · $ [PRECIO]',
        icon: 'card',
      });
    });

    it('pluralizes the balance part', () => {
      expect(
        comandaFooter(order({ ...partial, creditTotal: 4, creditsFromBalance: 3, estado: 'PENDIENTE' }), {
          now: NOW,
          walletAvailable: 0,
        }),
      ).toEqual({
        label: 'Reservaste 3 almuerzos de tu saldo',
        value: 'Pagado con Mercado Pago: 1 · $ [PRECIO]',
        icon: 'card',
      });
    });

    it('paid partly, already picked up: says the lunches were used, not reserved', () => {
      expect(
        comandaFooter(order({ ...partial, estado: 'ENTREGADO', pickupAt: PAST }), { now: NOW, walletAvailable: 0 }).label,
      ).toBe('Usaste 1 almuerzo de tu saldo');
    });

    it('pending payment: the balance part is reserved and the rest is still to pay', () => {
      expect(
        comandaFooter(order({ ...partial, estado: 'PENDIENTE_PAGO' }), { now: NOW, walletAvailable: 0 }),
      ).toEqual({
        label: '1 de tu saldo (reservado)',
        value: 'A pagar con Mercado Pago: 1 · $ [PRECIO]',
        icon: 'card',
      });
      expect(
        comandaFooter(order({ ...partial, creditTotal: 4, creditsFromBalance: 3, estado: 'PENDIENTE_PAGO' }), {
          now: NOW,
          walletAvailable: 0,
        }).label,
      ).toBe('3 de tu saldo (reservados)');
    });

    it('cancelled while partly reserved: the reserved lunches went back to the balance', () => {
      expect(comandaFooter(order({ ...partial, estado: 'CANCELADO' }), { now: NOW, walletAvailable: 10 })).toEqual({
        label: 'Pedido cancelado',
        value: '1 almuerzo devuelto a tu saldo',
        icon: 'lunches',
      });
    });

    it('with no balance part the footers stay as before', () => {
      expect(
        comandaFooter(order({ estado: 'PENDIENTE_PAGO', paidWithMercadoPago: true, creditsFromBalance: 0 }), {
          now: NOW,
          walletAvailable: 0,
        }),
      ).toEqual({ label: 'A pagar con Mercado Pago', value: '$ [PRECIO]', icon: 'card' });
    });

    it('comandaCopy tells the reserved lunches return to the balance if the payment is not confirmed', () => {
      const copy = comandaCopy(order({ ...partial, estado: 'PENDIENTE_PAGO' }), { now: NOW, pickupLeadMinutes: 20 });

      expect(copy.title).toBe('Falta confirmar el pago');
      expect(copy.headline).toMatch(/se cancela y tu almuerzo reservado vuelve a tu saldo\.$/);
    });

    it('comandaCopy says how many lunches came back when a partly reserved order is cancelled', () => {
      expect(comandaCopy(order({ ...partial, estado: 'CANCELADO' }), { now: NOW }).headline).toBe(
        '1 almuerzo volvió a tu saldo.',
      );
    });
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
