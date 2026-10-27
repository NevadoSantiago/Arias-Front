import { describe, expect, it, vi } from 'vitest';
import { activeAccountDiscount, applyAccountDiscount, formatDiscountCountdown, formatPrice, formatPriceExact } from './packPricing';

describe('formatPrice (customer screens)', () => {
  it('shows whole pesos without cents', () => {
    expect(formatPrice(1600000)).toMatch(/^\$\s?16\.000$/);
  });

  it('rounds a fractional per-lunch price to the nearest peso', () => {
    expect(formatPrice(533333)).toMatch(/^\$\s?5\.333$/);
    expect(formatPrice(533350)).toMatch(/^\$\s?5\.334$/);
  });

  it('sets minimumFractionDigits to 0 so older Safari does not throw a RangeError', () => {
    // Before Intl.NumberFormat v3 (Safari <= 15.3), a maximumFractionDigits below the
    // currency default minimum (2 for ARS) throws instead of rounding.
    const spy = vi.spyOn(Number.prototype, 'toLocaleString');
    formatPrice(1600000);
    expect(spy).toHaveBeenCalledWith(
      'es-AR',
      expect.objectContaining({ minimumFractionDigits: 0, maximumFractionDigits: 0 }),
    );
    spy.mockRestore();
  });
});

describe('formatPriceExact (admin screens)', () => {
  it('keeps the cents', () => {
    expect(formatPriceExact(1600000)).toMatch(/^\$\s?16\.000,00$/);
    expect(formatPriceExact(84960)).toMatch(/^\$\s?849,60$/);
  });
});

describe('applyAccountDiscount (mirrors the server formula)', () => {
  const d = (percent: number) => ({ percent, expiresAt: '2026-11-02T16:42:00Z' });

  it('returns the list price when there is no discount', () => {
    expect(applyAccountDiscount(700000, null)).toBe(700000);
    expect(applyAccountDiscount(700000, undefined)).toBe(700000);
  });

  it('takes the percent off and keeps whole pesos', () => {
    expect(applyAccountDiscount(700000, d(10))).toBe(630000);
  });

  it('rounds the total DOWN to a whole peso (in favor of the customer)', () => {
    // 150000 * 0.85 = 127500 -> 127500 (whole pesos are multiples of 100 cents)
    expect(applyAccountDiscount(149999, d(10))).toBe(134900); // 134999.1 -> floor to 134900
    expect(applyAccountDiscount(123456, d(15))).toBe(104900); // 104937.6 -> 104900
  });

  it('gives no discount if it would bring the total to zero', () => {
    expect(applyAccountDiscount(50, d(10))).toBe(50);
    expect(applyAccountDiscount(100, d(100))).toBe(100);
  });
});

describe('formatDiscountCountdown', () => {
  const now = new Date('2026-10-26T12:00:00Z');
  const at = (ms: number) => new Date(now.getTime() + ms).toISOString();
  const H = 3_600_000;

  it('shows days and hours when there is more than a day left', () => {
    expect(formatDiscountCountdown(at(164 * H), now)).toEqual({ label: 'Vence en 6 d 20 h', urgent: false });
  });

  it('shows only hours (urgent) in the last day', () => {
    expect(formatDiscountCountdown(at(5 * H + 10 * 60_000), now)).toEqual({ label: 'Vence en 5 h', urgent: true });
  });

  it('never shows less than one hour', () => {
    expect(formatDiscountCountdown(at(10 * 60_000), now)).toEqual({ label: 'Vence en 1 h', urgent: true });
  });

  it('is null once expired', () => {
    expect(formatDiscountCountdown(at(-1000), now)).toBeNull();
  });
});

describe('activeAccountDiscount', () => {
  const now = new Date('2026-10-26T12:00:00Z');

  it('keeps a discount that has not expired', () => {
    const d = { percent: 10, expiresAt: '2026-10-27T12:00:00Z' };
    expect(activeAccountDiscount(d, now)).toBe(d);
  });

  it('drops a missing or expired discount (the server price wins at pay time)', () => {
    expect(activeAccountDiscount(null, now)).toBeNull();
    expect(activeAccountDiscount(undefined, now)).toBeNull();
    expect(activeAccountDiscount({ percent: 10, expiresAt: '2026-10-26T11:59:59Z' }, now)).toBeNull();
  });
});
