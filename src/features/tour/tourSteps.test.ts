import { describe, expect, it } from 'vitest';
import { buildTourSteps, nextStepId, stepCounter } from './tourSteps';

describe('buildTourSteps', () => {
  it('starts with the centered gift card and ends with the closing card', () => {
    const steps = buildTourSteps({ isDesktop: false });

    expect(steps[0]).toMatchObject({ id: 'welcome', kind: 'card', title: '¡Te regalamos un almuerzo!' });
    expect(steps[steps.length - 1]).toMatchObject({ id: 'final', kind: 'card' });
  });

  it('closes telling the customer the order is ready to confirm or modify', () => {
    const final = buildTourSteps({ isDesktop: false }).find((s) => s.id === 'final');

    expect(final?.text).toBe('Quedó tu pedido armado con tu almuerzo de regalo. Podés confirmarlo o modificarlo a tu gusto.');
  });

  it('walks the ordering flow in the agreed order on mobile', () => {
    const ids = buildTourSteps({ isDesktop: false }).map((s) => s.id);

    expect(ids).toEqual([
      'welcome', 'balance-chip', 'balance-chip-tap', 'buy', 'logo',
      'dish', 'sides', 'add', 'cart', 'picker', 'balance-box', 'confirm', 'final',
    ]);
  });

  it('skips the "Ver pedido" step on desktop, where the review is an always-visible panel', () => {
    const ids = buildTourSteps({ isDesktop: true }).map((s) => s.id);

    expect(ids).not.toContain('cart');
    expect(ids).toContain('picker');
  });

  it('makes the confirm step informational so the tour never places an order', () => {
    const confirm = buildTourSteps({ isDesktop: false }).find((s) => s.id === 'confirm');

    expect(confirm?.mode).toBe('info');
  });

  it('never mentions the per-order lunch cost in any copy', () => {
    const copy = buildTourSteps({ isDesktop: false }).map((s) => `${s.title} ${s.text}`).join(' ');

    expect(copy).not.toMatch(/usa \d+ almuerzo/i);
  });

  it('puts every tappable step on a data-tour target', () => {
    for (const step of buildTourSteps({ isDesktop: false })) {
      if (step.kind === 'spot') expect(step.target).toMatch(/^[a-z-]+$/);
    }
  });
});

describe('stepCounter', () => {
  it('counts only the spotlight steps, so the cards carry no counter', () => {
    const steps = buildTourSteps({ isDesktop: false });

    expect(stepCounter(steps, 'welcome')).toBeNull();
    expect(stepCounter(steps, 'balance-chip')).toEqual({ position: 1, total: 11 });
    expect(stepCounter(steps, 'confirm')).toEqual({ position: 11, total: 11 });
    expect(stepCounter(steps, 'final')).toBeNull();
  });

  it('adapts the total on desktop', () => {
    expect(stepCounter(buildTourSteps({ isDesktop: true }), 'balance-chip')).toEqual({ position: 1, total: 10 });
  });
});

describe('nextStepId', () => {
  it('returns the following step and null after the last one', () => {
    const steps = buildTourSteps({ isDesktop: false });

    expect(nextStepId(steps, 'welcome')).toBe('balance-chip');
    expect(nextStepId(steps, 'final')).toBeNull();
  });
});
