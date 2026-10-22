import { describe, expect, it, vi } from 'vitest';
import { formatPrice, formatPriceExact } from './packPricing';

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
