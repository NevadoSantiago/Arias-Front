import { describe, expect, it } from 'vitest';
import { buildTourSteps, nextStepId, stepCounter } from './tourSteps';

describe('buildTourSteps', () => {
  describe('accounts without the welcome lunch', () => {
    const steps = buildTourSteps({ isDesktop: false, receivedWelcomeLunch: false });

    it('skips the gift card and starts at the balance chip', () => {
      expect(steps.map((s) => s.id)).not.toContain('welcome');
      expect(steps[0].id).toBe('balance-chip');
    });

    it('explains the balance without mentioning a gift', () => {
      expect(steps.find((s) => s.id === 'balance-chip')?.text).toBe(
        'Acá ves tus almuerzos disponibles. Cargá un paquete para hacer tu primer pedido.',
      );
    });

    it('keeps the rest of the walk-through untouched', () => {
      const withGift = buildTourSteps({ isDesktop: false }).filter((s) => s.id !== 'welcome' && s.id !== 'balance-chip');
      expect(steps.filter((s) => s.id !== 'balance-chip')).toEqual(withGift);
    });
  });

  it.each([true, undefined])('keeps the current gift card and balance text when receivedWelcomeLunch is %s', (flag) => {
    const steps = buildTourSteps({ isDesktop: false, receivedWelcomeLunch: flag });

    expect(steps[0].id).toBe('welcome');
    expect(steps.find((s) => s.id === 'balance-chip')?.text).toBe(
      'Te regalamos 1 para que pruebes. Lo usás cuando confirmás tu primer pedido.',
    );
  });

  it('has no separate "tap your balance" step', () => {
    expect(buildTourSteps({ isDesktop: false }).map((s) => s.id)).not.toContain('balance-chip-tap');
  });

  it('starts with the centered gift card and ends with the closing card', () => {
    const steps = buildTourSteps({ isDesktop: false });

    expect(steps[0]).toMatchObject({ id: 'welcome', kind: 'card', title: '¡Te regalamos un almuerzo!' });
    expect(steps[steps.length - 1]).toMatchObject({ id: 'final', kind: 'card' });
  });

  it('closes telling the customer they know how to place their next order', () => {
    const final = buildTourSteps({ isDesktop: false }).find((s) => s.id === 'final');

    expect(final).toMatchObject({ title: '¡Listo!', text: 'Ya sabés cómo hacer tu próximo pedido. ¡Que lo disfrutes!' });
  });

  it('walks the ordering flow in the agreed order on mobile', () => {
    const ids = buildTourSteps({ isDesktop: false }).map((s) => s.id);

    expect(ids).toEqual([
      'welcome', 'balance-chip', 'buy', 'logo',
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

    expect(confirm).toMatchObject({ kind: 'spot', mode: 'info' });
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

describe('sides step cutout cap', () => {
  it.each([false, true])('caps the sides cutout and scrolls it to the start (isDesktop: %s)', (isDesktop) => {
    const sides = buildTourSteps({ isDesktop }).find((s) => s.id === 'sides');

    expect(sides).toMatchObject({ kind: 'spot', maxHeightRatio: 0.45, scroll: 'start' });
  });

  it('does not cap any other spot step', () => {
    const capped = buildTourSteps({ isDesktop: false }).filter((s) => s.kind === 'spot' && s.maxHeightRatio !== undefined);

    expect(capped.map((s) => s.id)).toEqual(['sides']);
  });
});

describe('stepCounter', () => {
  it('counts only the spotlight steps, so the cards carry no counter', () => {
    const steps = buildTourSteps({ isDesktop: false });

    expect(stepCounter(steps, 'welcome')).toBeNull();
    expect(stepCounter(steps, 'balance-chip')).toEqual({ position: 1, total: 10 });
    expect(stepCounter(steps, 'confirm')).toEqual({ position: 10, total: 10 });
    expect(stepCounter(steps, 'final')).toBeNull();
  });

  it('adapts the total on desktop', () => {
    expect(stepCounter(buildTourSteps({ isDesktop: true }), 'balance-chip')).toEqual({ position: 1, total: 9 });
  });
});

describe('nextStepId', () => {
  it('returns the following step and null after the last one', () => {
    const steps = buildTourSteps({ isDesktop: false });

    expect(nextStepId(steps, 'welcome')).toBe('balance-chip');
    expect(nextStepId(steps, 'balance-chip')).toBe('buy');
    expect(nextStepId(steps, 'final')).toBeNull();
  });
});
