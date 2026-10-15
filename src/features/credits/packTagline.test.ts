import { describe, expect, it } from 'vitest';
import { packTagline } from './packPricing';

describe('packTagline', () => {
  it('uses "Resolvé hoy" for a single lunch', () => {
    expect(packTagline(1)).toBe('Resolvé hoy');
  });

  it.each([2, 5, 9])('uses "Resolvé tu semana" for %i lunches', (n) => {
    expect(packTagline(n)).toBe('Resolvé tu semana');
  });

  it.each([10, 20, 40])('uses "¡Resolvé todo el mes!" for %i lunches', (n) => {
    expect(packTagline(n)).toBe('¡Resolvé todo el mes!');
  });
});
