import { describe, expect, it } from 'vitest';
import { dailyIllustrationIndex } from './dailyIllustration';

describe('dailyIllustrationIndex', () => {
  it('is in [0, count) and deterministic for the same date', () => {
    const date = new Date(2026, 9, 1, 9, 30);
    const index = dailyIllustrationIndex(date);
    expect(index).toBeGreaterThanOrEqual(0);
    expect(index).toBeLessThan(5);
    expect(dailyIllustrationIndex(new Date(2026, 9, 1, 23, 59))).toBe(index);
    expect(dailyIllustrationIndex(date)).toBe(index);
  });

  it('hashes the local YYYY-MM-DD string (known values)', () => {
    expect(dailyIllustrationIndex(new Date(2026, 9, 1))).toBe(0);
    expect(dailyIllustrationIndex(new Date(2026, 9, 2))).toBe(1);
    expect(dailyIllustrationIndex(new Date(2026, 8, 24))).toBe(3);
  });

  it('uses the local calendar day, not UTC', () => {
    // 22:30 local on the 1st is already the 2nd in UTC for any negative offset; the local day must win.
    expect(dailyIllustrationIndex(new Date(2026, 9, 1, 22, 30))).toBe(dailyIllustrationIndex(new Date(2026, 9, 1, 1, 0)));
  });

  it('touches every illustration over 30 consecutive days', () => {
    const seen = new Set<number>();
    for (let day = 1; day <= 30; day++) seen.add(dailyIllustrationIndex(new Date(2026, 8, day)));
    expect([...seen].sort()).toEqual([0, 1, 2, 3, 4]);
  });

  it('honors a custom count', () => {
    for (let day = 1; day <= 30; day++) {
      expect(dailyIllustrationIndex(new Date(2026, 8, day), 3)).toBeLessThan(3);
    }
  });
});
