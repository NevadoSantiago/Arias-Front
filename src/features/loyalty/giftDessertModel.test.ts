import { describe, expect, it } from 'vitest';
import { dessertTeaser, lunchesToDessert, pendingGift } from './giftDessertModel';
import type { Loyalty, LoyaltyMilestone } from './types';

const DAY = 86_400_000;
const inDays = (n: number) => new Date(Date.now() + n * DAY).toISOString();

const milestones = (dessert: Partial<LoyaltyMilestone> = {}): LoyaltyMilestone[] => [
  { lunches: 6, kind: 'DESSERT', status: 'LOCKED', expiresAt: null, ...dessert },
  { lunches: 18, kind: 'LUNCH', status: 'LOCKED', expiresAt: null },
];

function loyalty(over: Record<string, unknown> = {}): Loyalty {
  return {
    enabled: true,
    cycle: { startedAt: inDays(-10), endsAt: inDays(50), lunches: 4 },
    waiting: false,
    milestones: milestones(),
    pendingDessert: null,
    ...over,
  } as Loyalty;
}

describe('pendingGift', () => {
  it('is the pending dessert while it has not expired', () => {
    const pending = { rewardId: 1, expiresAt: inDays(3) };
    expect(pendingGift(loyalty({ pendingDessert: pending }))).toEqual(pending);
  });

  it('is null when expired, absent, disabled or not loaded', () => {
    expect(pendingGift(loyalty({ pendingDessert: { rewardId: 1, expiresAt: inDays(-1) } }))).toBeNull();
    expect(pendingGift(loyalty())).toBeNull();
    expect(pendingGift({ enabled: false })).toBeNull();
    expect(pendingGift(undefined)).toBeNull();
  });
});

describe('lunchesToDessert', () => {
  it('counts the lunches left for the dessert milestone from the server data', () => {
    expect(lunchesToDessert(loyalty())).toBe(2);
    expect(lunchesToDessert(loyalty({ milestones: milestones({ lunches: 8 }) }))).toBe(4);
  });

  it('counts from zero while the cycle has not started', () => {
    expect(lunchesToDessert(loyalty({ cycle: null }))).toBe(6);
  });

  it('is null once the dessert is earned, used or expired, or a dessert is pending', () => {
    expect(lunchesToDessert(loyalty({ milestones: milestones({ status: 'EARNED' }) }))).toBeNull();
    expect(lunchesToDessert(loyalty({ milestones: milestones({ status: 'USED' }) }))).toBeNull();
    expect(lunchesToDessert(loyalty({ milestones: milestones({ status: 'EXPIRED' }) }))).toBeNull();
    expect(lunchesToDessert(loyalty({ pendingDessert: { rewardId: 1, expiresAt: inDays(2) } }))).toBeNull();
  });

  it('is null when the line is disabled, not loaded or has no dessert milestone', () => {
    expect(lunchesToDessert({ enabled: false })).toBeNull();
    expect(lunchesToDessert(undefined)).toBeNull();
    expect(lunchesToDessert(loyalty({ milestones: [milestones()[1]] }))).toBeNull();
  });

  it('is null when the count already reached the milestone', () => {
    expect(lunchesToDessert(loyalty({ cycle: { startedAt: inDays(-10), endsAt: inDays(50), lunches: 6 } }))).toBeNull();
  });
});

describe('dessertTeaser', () => {
  it('says how many lunches are missing, singular and plural', () => {
    expect(dessertTeaser(4)).toBe('Te faltan 4 almuerzos para tu postre de regalo.');
    expect(dessertTeaser(1)).toBe('Te falta 1 almuerzo para tu postre de regalo.');
  });
});
