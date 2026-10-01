import { describe, expect, it } from 'vitest';
import { buildCatalog, DEFAULT_EXPIRY_DAYS, expiryAfterPurchase, planPurchase, resolveSelection } from './purchaseModel';
import type { CreditPack } from './types';

const pack = (over: Partial<CreditPack> & Pick<CreditPack, 'id' | 'code'>): CreditPack => ({
  packType: 'OTRO',
  nombre: over.code,
  creditAmount: 1,
  priceCents: 150000,
  discountPercent: 0,
  ordenDisplay: over.id,
  enabled: true,
  ...over,
});

const day = pack({ id: 1, code: 'X-IND', packType: 'INDIVIDUAL', nombre: 'Sueltos' });
const week = pack({ id: 2, code: 'X-SUG', packType: 'SUGERIDO', nombre: 'Paquete Semana', creditAmount: 5, priceCents: 700000, discountPercent: 10 });
const month = pack({ id: 3, code: 'MONTH', packType: 'OTRO', nombre: 'Paquete Mes', creditAmount: 20, priceCents: 2400000, discountPercent: 20 });

describe('buildCatalog', () => {
  it('splits DAY from the named packs, drops disabled ones and orders by ordenDisplay', () => {
    const catalog = buildCatalog([month, pack({ id: 9, code: 'OLD', enabled: false }), day, week]);

    expect(catalog.dayPack).toBe(day);
    expect(catalog.namedPacks).toEqual([week, month]);
    expect(catalog.recommended).toBe(month);
  });

  it('finds the Semana pack by type, falling back to the first named pack', () => {
    expect(buildCatalog([day, week, month]).weekPack).toBe(week);
    const renamed = pack({ id: 4, code: 'PACK5', creditAmount: 5, ordenDisplay: 1 });
    expect(buildCatalog([day, renamed, month]).weekPack).toBe(renamed);
  });

  it('is empty for undefined input', () => {
    expect(buildCatalog(undefined)).toEqual({ dayPack: null, namedPacks: [], recommended: null, weekPack: null });
  });
});

describe('resolveSelection', () => {
  const catalog = buildCatalog([day, week, month]);

  it('keeps an explicit selection', () => {
    expect(resolveSelection({ kind: 'pack', packId: 3 }, catalog, 'week')).toEqual({ kind: 'pack', packId: 3 });
  });

  it('starts on Sueltos or on Semana depending on the requested default', () => {
    expect(resolveSelection(null, catalog, 'loose')).toEqual({ kind: 'loose' });
    expect(resolveSelection(null, catalog, 'week')).toEqual({ kind: 'pack', packId: 2 });
  });

  it('falls back to the recommended pack when Sueltos is not on sale', () => {
    const noDay = buildCatalog([week, month]);
    expect(resolveSelection(null, noDay, 'loose')).toEqual({ kind: 'pack', packId: 3 });
    expect(resolveSelection({ kind: 'loose' }, noDay, 'week')).toEqual({ kind: 'pack', packId: 3 });
  });

  it('is null when nothing is on sale', () => {
    expect(resolveSelection(null, buildCatalog([]), 'week')).toBeNull();
  });
});

describe('planPurchase', () => {
  const catalog = buildCatalog([day, week, month]);

  it('plans Sueltos as the DAY pack times the quantity', () => {
    const plan = planPurchase({ kind: 'loose' }, 3, catalog, 12)!;

    expect(plan.payload).toEqual({ packId: 1, quantity: 3 });
    expect(plan.summary.label).toBe('Sueltos · 3 almuerzos');
    expect(plan.summary.totalLabel).toMatch(/4\.500/);
    expect(plan.checkout).toMatchObject({ isLoose: true, hasDiscount: false, fromAvailable: 12, toAvailable: 15 });
  });

  it('plans a named pack without quantity, with its discount and new balance', () => {
    const plan = planPurchase({ kind: 'pack', packId: 2 }, 7, catalog, 12)!;

    expect(plan.payload).toEqual({ packId: 2 });
    expect(plan.summary.label).toBe('Paquete Semana · 5 almuerzos');
    expect(plan.checkout).toMatchObject({
      isLoose: false,
      productName: 'Paquete Semana',
      hasDiscount: true,
      discountLabel: '−10%',
      fromAvailable: 12,
      toAvailable: 17,
    });
    expect(plan.checkout.perLunchLabel).toMatch(/1\.400/);
  });

  it('leaves the balance unknown until the wallet loads, and is null for an unknown pack', () => {
    expect(planPurchase({ kind: 'pack', packId: 2 }, 1, catalog, null)!.checkout).toMatchObject({
      fromAvailable: null,
      toAvailable: null,
    });
    expect(planPurchase({ kind: 'pack', packId: 99 }, 1, catalog, 12)).toBeNull();
    expect(planPurchase(null, 1, catalog, 12)).toBeNull();
  });
});

describe('expiryAfterPurchase', () => {
  const now = new Date('2026-09-25T12:00:00-03:00');

  it('adds the configured expiry days to the purchase date', () => {
    expect(expiryAfterPurchase(30, now).toDateString()).toBe(new Date('2026-10-25T12:00:00-03:00').toDateString());
  });

  it('falls back to 90 days while the restaurant config is unknown', () => {
    expect(DEFAULT_EXPIRY_DAYS).toBe(90);
    expect(expiryAfterPurchase(undefined, now).toDateString()).toBe(new Date('2026-12-24T12:00:00-03:00').toDateString());
  });
});
