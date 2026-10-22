import { describe, expect, it } from 'vitest';
import { formatPrice, formatPriceExact } from './packPricing';

describe('formatPrice (customer screens)', () => {
  it('shows whole pesos without cents', () => {
    expect(formatPrice(1600000)).toMatch(/^\$\s?16\.000$/);
  });

  it('rounds a fractional per-lunch price to the nearest peso', () => {
    expect(formatPrice(533333)).toMatch(/^\$\s?5\.333$/);
    expect(formatPrice(533350)).toMatch(/^\$\s?5\.334$/);
  });
});

describe('formatPriceExact (admin screens)', () => {
  it('keeps the cents', () => {
    expect(formatPriceExact(1600000)).toMatch(/^\$\s?16\.000,00$/);
    expect(formatPriceExact(84960)).toMatch(/^\$\s?849,60$/);
  });
});
