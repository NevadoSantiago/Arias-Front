import { describe, expect, it } from 'vitest';
import { buildTourSteps, nextStepId, stepCounter } from './tourSteps';

describe('buildTourSteps', () => {
  it('starts with the centered gift card and ends with the closing card', () => {
    const steps = buildTourSteps({ isDesktop: false });

    expect(steps[0]).toMatchObject({ id: 'welcome', kind: 'card', title: '¡Te regalamos un almuerzo!' });
    expect(steps[steps.length - 1]).toMatchObject({ id: 'final', kind: 'card' });
  });

  it('walks the balance, where to buy more and back to the menu', () => {
    const ids = buildTourSteps({ isDesktop: false }).map((s) => s.id);

    expect(ids).toEqual(['welcome', 'balance-chip', 'balance-chip-tap', 'buy', 'logo', 'final']);
  });

  it('puts every spotlight step on a data-tour target', () => {
    for (const step of buildTourSteps({ isDesktop: false })) {
      if (step.kind === 'spot') expect(step.target).toMatch(/^[a-z-]+$/);
    }
  });
});

describe('stepCounter', () => {
  it('counts only the spotlight steps, so the cards carry no counter', () => {
    const steps = buildTourSteps({ isDesktop: false });

    expect(stepCounter(steps, 'welcome')).toBeNull();
    expect(stepCounter(steps, 'balance-chip')).toEqual({ position: 1, total: 4 });
    expect(stepCounter(steps, 'logo')).toEqual({ position: 4, total: 4 });
    expect(stepCounter(steps, 'final')).toBeNull();
  });
});

describe('nextStepId', () => {
  it('returns the following step and null after the last one', () => {
    const steps = buildTourSteps({ isDesktop: false });

    expect(nextStepId(steps, 'welcome')).toBe('balance-chip');
    expect(nextStepId(steps, 'final')).toBeNull();
  });
});
