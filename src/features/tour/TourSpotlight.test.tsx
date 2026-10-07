import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TourSpotlight } from './TourSpotlight';
import type { TourSpotStep } from './tourSteps';

const step = (mode: TourSpotStep['mode']): TourSpotStep => ({
  kind: 'spot',
  id: 'balance-chip',
  route: '/orders/today',
  title: 'Tu saldo',
  text: 'Acá ves tus almuerzos.',
  target: 'balance-chip',
  mode,
  radius: 8,
  guide: 'chef' as TourSpotStep['guide'],
});

function renderSpotlight(mode: TourSpotStep['mode']) {
  const target = document.createElement('a');
  target.setAttribute('data-tour', 'balance-chip');
  target.getBoundingClientRect = () =>
    ({ left: 250, top: 10, width: 100, height: 44, right: 350, bottom: 54, x: 250, y: 10 }) as DOMRect;
  document.body.appendChild(target);
  const utils = render(
    <TourSpotlight
      step={step(mode)}
      counter={{ position: 2, total: 8 }}
      canGoBack
      targetTimeoutMs={5000}
      onNext={vi.fn()}
      onPrev={vi.fn()}
      onSkip={vi.fn()}
      onTargetMissing={vi.fn()}
    />,
  );
  return { target, ...utils };
}

async function settle() {
  await act(async () => {
    await new Promise((r) => requestAnimationFrame(() => r(null)));
  });
}

afterEach(() => {
  document.body.innerHTML = '';
});

// jsdom no hace hit-testing: se verifica la estructura que lo garantiza en el navegador.
describe('TourSpotlight pointer events', () => {
  it('does not let the full-screen root swallow taps meant for the target', async () => {
    renderSpotlight('tap');
    await settle();

    const root = screen.getByRole('dialog').closest('.fixed.inset-0') as HTMLElement;
    expect(root).not.toBeNull();
    expect(root.className).toContain('pointer-events-none');
  });

  it('keeps the four panes blocking and leaves no blocker over the cutout on tap steps', async () => {
    renderSpotlight('tap');
    await settle();

    const blockers = document.querySelectorAll<HTMLElement>('[data-tour-block]');
    expect(blockers).toHaveLength(4);
    blockers.forEach((b) => expect(b.className).toContain('pointer-events-auto'));
  });

  it('adds a blocker over the cutout on info steps', async () => {
    renderSpotlight('info');
    await settle();

    expect(document.querySelectorAll('[data-tour-block]')).toHaveLength(5);
  });

  it('prevents wheel scrolling over a blocking pane (guard attaches once the root mounts)', async () => {
    renderSpotlight('tap');
    await settle();

    const pane = document.querySelector('[data-tour-block]') as HTMLElement;
    const event = new Event('wheel', { bubbles: true, cancelable: true });
    pane.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });
});
