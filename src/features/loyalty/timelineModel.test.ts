import { describe, expect, it } from 'vitest';
import {
  daysUntil, expiryText, formatDayMonth, positionFor, rewardText, statusFor,
} from './timelineModel';
import type { LoyaltyMilestone } from './types';

const T = [6, 18, 24];

describe('positionFor (non-proportional scale by marker index)', () => {
  it('maps the markers to 30%, 66% and 92%', () => {
    expect(positionFor(6, T)).toBe(30);
    expect(positionFor(18, T)).toBe(66);
    expect(positionFor(24, T)).toBe(92);
  });

  it('is 0 at zero or below and interpolates linearly between markers', () => {
    expect(positionFor(0, T)).toBe(0);
    expect(positionFor(-3, T)).toBe(0);
    expect(positionFor(3, T)).toBe(15);
    expect(positionFor(12, T)).toBe(48);
    expect(positionFor(21, T)).toBe(79);
  });

  it('creeps past the last marker towards 100% without exceeding it', () => {
    expect(positionFor(25, T)).toBe(94);
    expect(positionFor(26, T)).toBe(96);
    expect(positionFor(200, T)).toBe(100);
  });

  it('follows the thresholds it is given, not hardcoded values', () => {
    expect(positionFor(10, [10, 20, 30])).toBe(30);
    expect(positionFor(30, [10, 20, 30])).toBe(92);
  });
});

describe('dates', () => {
  it('formats d/M without padding', () => {
    expect(formatDayMonth('2026-10-20T15:00:00Z')).toBe('20/10');
    expect(formatDayMonth('2026-11-04T15:00:00Z')).toBe('4/11');
  });

  it('counts calendar days until the expiry', () => {
    const now = new Date('2026-11-06T15:00:00Z');
    expect(daysUntil('2026-11-06T23:00:00Z', now)).toBe(0);
    expect(daysUntil('2026-11-07T15:00:00Z', now)).toBe(1);
    expect(daysUntil('2026-11-13T15:00:00Z', now)).toBe(7);
  });

  it('words the expiry', () => {
    expect(expiryText(0)).toBe('vence hoy');
    expect(expiryText(1)).toBe('vence mañana');
    expect(expiryText(5)).toBe('vence en 5 días');
  });
});

const m = (over: Partial<LoyaltyMilestone>): LoyaltyMilestone => ({
  lunches: 6, kind: 'DESSERT', status: 'LOCKED', expiresAt: null, ...over,
});

describe('statusFor', () => {
  it('shows every marker locked without an active cycle', () => {
    expect(statusFor(m({ status: 'EARNED' }), false)).toBe('locked');
  });

  it('maps the API statuses', () => {
    expect(statusFor(m({ status: 'LOCKED' }), true)).toBe('locked');
    expect(statusFor(m({ status: 'EARNED' }), true)).toBe('ready');
    expect(statusFor(m({ status: 'USED' }), true)).toBe('done');
    expect(statusFor(m({ status: 'EXPIRED' }), true)).toBe('expired');
  });

  it('never marks a gift lunch as ready (nothing to use)', () => {
    expect(statusFor(m({ kind: 'LUNCH', status: 'EARNED' }), true)).toBe('done');
  });
});

describe('rewardText', () => {
  it('words each reward kind', () => {
    expect(rewardText(m({ kind: 'DESSERT' }))).toBe('un postre de regalo');
    expect(rewardText(m({ kind: 'LUNCH' }))).toBe('un almuerzo de regalo');
    expect(rewardText(m({ kind: 'DISCOUNT', percent: 10 }))).toBe('10% off en tu próxima compra');
  });
});
