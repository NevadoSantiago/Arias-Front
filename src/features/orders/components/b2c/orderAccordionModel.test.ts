import { describe, expect, it } from 'vitest';
import { orderAccordionHeader } from './orderAccordionModel';
import type { OrderV2 } from '../../services/ordersApi';

const NOW = new Date('2026-09-24T11:40:00-03:00');

const base: OrderV2 = {
  id: 202,
  fecha: '2026-09-25',
  pickupAt: '2026-09-25T13:00:00-03:00',
  estado: 'PENDIENTE',
  creditTotal: 2,
  notas: null,
  items: [
    { id: 1, dishId: 10, dishNombre: 'Milanesa', dishCategoria: 'Premium', sideId: 5, sideNombre: 'Puré', creditCost: 1, notas: null },
    { id: 2, dishId: 11, dishNombre: 'Ensalada', dishCategoria: 'Básico', sideId: null, sideNombre: null, creditCost: 1, notas: null },
  ],
  cancellable: true,
  modifiable: true,
  pickupTimeChangeable: true,
  paidWithMercadoPago: false,
  creditsFromBalance: 0,
};

const header = (order: OrderV2, pickupLeadMinutes: number | null = 20) =>
  orderAccordionHeader(order, { now: NOW, pickupLeadMinutes });

describe('orderAccordionHeader', () => {
  it('gives the pickup time and "N platos · N almuerzos"', () => {
    expect(header(base)).toMatchObject({ time: 'Retiro 13:00 hs', summary: '2 platos · 2 almuerzos' });
    expect(header({ ...base, items: [base.items[0]], creditTotal: 1 }).summary).toBe('1 plato · 1 almuerzo');
  });

  it('gives the date without the month for the "Anteriores" rows', () => {
    expect(header({ ...base, pickupAt: '2026-09-22T13:10:00-03:00' }).dateLabel).toBe('Martes 22');
  });

  it('has no payment line for an order paid with lunches from the balance', () => {
    expect(header(base).payLine).toBeNull();
  });

  it('says "Pagado con Mercado Pago" for a confirmed order paid with it', () => {
    const paid: OrderV2 = { ...base, estado: 'CONFIRMADO', paidWithMercadoPago: true };
    expect(header(paid).payLine).toBe('Pagado con Mercado Pago');
  });

  it('splits a partial payment: "N de tu saldo · M con Mercado Pago"', () => {
    const paid: OrderV2 = { ...base, estado: 'CONFIRMADO', paidWithMercadoPago: true, creditsFromBalance: 1 };
    expect(header(paid).payLine).toBe('1 de tu saldo · 1 con Mercado Pago');
  });

  it('awaiting payment: "N de tu saldo · M a pagar" with the cutoff time', () => {
    const awaiting: OrderV2 = {
      ...base,
      estado: 'PENDIENTE_PAGO',
      pickupAt: '2026-09-24T13:00:00-03:00',
      paidWithMercadoPago: true,
      creditsFromBalance: 1,
    };
    expect(header(awaiting).payLine).toBe('1 de tu saldo · 1 a pagar, antes de las 12:40');
    expect(header(awaiting, null).payLine).toBe('1 de tu saldo · 1 a pagar');
  });

  it('awaiting payment without balance: "A pagar con Mercado Pago"', () => {
    const awaiting: OrderV2 = { ...base, estado: 'PENDIENTE_PAGO', paidWithMercadoPago: true };
    expect(header(awaiting, null).payLine).toBe('A pagar con Mercado Pago');
  });

  it('cancelled with lunches: says they went back, with no invented number for partial payments', () => {
    const cancelled: OrderV2 = { ...base, estado: 'CANCELADO' };
    expect(header(cancelled).payLine).toBe('2 almuerzos devueltos a tu saldo');
    expect(header({ ...cancelled, creditTotal: 1 }).payLine).toBe('1 almuerzo devuelto a tu saldo');
    const partial: OrderV2 = { ...cancelled, paidWithMercadoPago: true, creditsFromBalance: 1 };
    expect(header(partial).payLine).toBe('Los almuerzos reservados volvieron a tu saldo');
  });

  it('cancelled and paid only with Mercado Pago: the payment is credited', () => {
    const cancelled: OrderV2 = { ...base, estado: 'CANCELADO', paidWithMercadoPago: true };
    expect(header(cancelled).payLine).toBe('Si pagaste con Mercado Pago, lo que pagaste se acredita en tu saldo.');
  });

  it('notes that a scheduled order can no longer be changed', () => {
    expect(header({ ...base, pickupTimeChangeable: false }).note).toBe('Ya no se puede cambiar');
    expect(header(base).note).toBeNull();
  });

  it('notes that a confirmed upcoming order is being prepared', () => {
    expect(header({ ...base, estado: 'CONFIRMADO', pickupTimeChangeable: false }).note).toBe('Ya lo estamos preparando');
  });

  it('adds no note to a past order', () => {
    const past: OrderV2 = { ...base, estado: 'PENDIENTE', pickupAt: '2026-09-22T13:00:00-03:00', pickupTimeChangeable: false };
    expect(header(past).note).toBeNull();
  });

  it('never says "créditos"', () => {
    const text = JSON.stringify([header(base), header({ ...base, estado: 'CANCELADO' })]);
    expect(text).not.toMatch(/créditos?/i);
  });
});
