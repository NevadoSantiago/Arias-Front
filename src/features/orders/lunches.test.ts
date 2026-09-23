import { describe, expect, it } from 'vitest';
import { formatLunches } from './lunches';

describe('formatLunches', () => {
  it('uses the singular form for exactly 1', () => {
    expect(formatLunches(1)).toBe('1 almuerzo');
  });

  it('uses the plural form for 0 and for more than 1', () => {
    expect(formatLunches(0)).toBe('0 almuerzos');
    expect(formatLunches(3)).toBe('3 almuerzos');
  });

  it('never says "créditos"', () => {
    expect(formatLunches(1)).not.toMatch(/crédito/i);
    expect(formatLunches(5)).not.toMatch(/crédito/i);
  });
});
