import { act, fireEvent, render, screen } from '@testing-library/react';
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

function renderSpotlight(mode: TourSpotStep['mode'], onNext: () => void = vi.fn()) {
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
      onNext={onNext}
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

describe('TourSpotlight overlay tap', () => {
  it.each(['info', 'try'] as const)('advances when a dark pane is clicked on %s steps', async (mode) => {
    const onNext = vi.fn();
    renderSpotlight(mode, onNext);
    await settle();

    fireEvent.click(document.querySelector('[data-tour-block]') as HTMLElement);

    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('advances when the blocker over the cutout is clicked on info steps', async () => {
    const onNext = vi.fn();
    renderSpotlight('info', onNext);
    await settle();

    const blockers = document.querySelectorAll<HTMLElement>('[data-tour-block]');
    fireEvent.click(blockers[blockers.length - 1]);

    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('does not advance when a pane is clicked on tap steps', async () => {
    const onNext = vi.fn();
    renderSpotlight('tap', onNext);
    await settle();

    document.querySelectorAll<HTMLElement>('[data-tour-block]').forEach((pane) => fireEvent.click(pane));

    expect(onNext).not.toHaveBeenCalled();
  });

  it('does not advance when the bubble is clicked', async () => {
    const onNext = vi.fn();
    renderSpotlight('info', onNext);
    await settle();

    fireEvent.click(screen.getByRole('dialog'));

    expect(onNext).not.toHaveBeenCalled();
  });

  it('does not advance from the invisible block shown while the target is missing', () => {
    const onNext = vi.fn();
    render(
      <TourSpotlight
        step={step('info')}
        counter={null}
        canGoBack
        targetTimeoutMs={5000}
        onNext={onNext}
        onPrev={vi.fn()}
        onSkip={vi.fn()}
        onTargetMissing={vi.fn()}
      />,
    );

    fireEvent.click(document.querySelector('[data-tour-block]') as HTMLElement);

    expect(onNext).not.toHaveBeenCalled();
  });
});

describe('TourSpotlight tap arrow', () => {
  it('points an arrow at the target on tap steps instead of the "tocá acá" pill', async () => {
    renderSpotlight('tap');
    await settle();

    expect(document.querySelector('[data-tour-arrow]')).not.toBeNull();
    expect(screen.queryByText('Tocá acá para seguir')).not.toBeInTheDocument();
  });

  it.each(['info', 'try'] as const)('renders no arrow on %s steps', async (mode) => {
    renderSpotlight(mode);
    await settle();

    expect(document.querySelector('[data-tour-arrow]')).toBeNull();
  });

  it('is decorative and never captures taps', async () => {
    renderSpotlight('tap');
    await settle();

    const arrow = document.querySelector('[data-tour-arrow]') as HTMLElement;
    expect(arrow).toHaveAttribute('aria-hidden', 'true');
    expect(arrow.className).toContain('pointer-events-none');
  });
});

describe('TourSpotlight holdTarget and note', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function missingTarget(holdTarget: boolean, onTargetMissing: () => void) {
    return (
      <TourSpotlight
        step={step('tap')}
        counter={null}
        canGoBack
        targetTimeoutMs={5000}
        holdTarget={holdTarget}
        onNext={vi.fn()}
        onPrev={vi.fn()}
        onSkip={vi.fn()}
        onTargetMissing={onTargetMissing}
      />
    );
  }

  it('does not report a missing target while holdTarget is on, and starts counting once it is released', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const onTargetMissing = vi.fn();
    const { rerender } = render(missingTarget(true, onTargetMissing));

    act(() => {
      vi.advanceTimersByTime(20000);
    });
    expect(onTargetMissing).not.toHaveBeenCalled();
    // Mientras espera sigue el bloqueo transparente.
    expect(document.querySelector('[data-tour-block]')).not.toBeNull();

    rerender(missingTarget(false, onTargetMissing));
    act(() => {
      vi.advanceTimersByTime(4999);
    });
    expect(onTargetMissing).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(2);
    });
    expect(onTargetMissing).toHaveBeenCalledTimes(1);
  });

  it('reports a missing target after the timeout when holdTarget is off', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const onTargetMissing = vi.fn();
    render(missingTarget(false, onTargetMissing));

    act(() => {
      vi.advanceTimersByTime(5001);
    });

    expect(onTargetMissing).toHaveBeenCalledTimes(1);
  });

  it('renders the note under the text when given, and nothing when not', async () => {
    const target = document.createElement('a');
    target.setAttribute('data-tour', 'balance-chip');
    target.getBoundingClientRect = () =>
      ({ left: 250, top: 10, width: 100, height: 44, right: 350, bottom: 54, x: 250, y: 10 }) as DOMRect;
    document.body.appendChild(target);
    const props = {
      step: step('tap'),
      counter: null,
      canGoBack: true,
      targetTimeoutMs: 5000,
      onNext: vi.fn(),
      onPrev: vi.fn(),
      onSkip: vi.fn(),
      onTargetMissing: vi.fn(),
    };
    const { rerender } = render(<TourSpotlight {...props} />);
    await settle();
    expect(screen.queryByText(/te llevamos al/i)).not.toBeInTheDocument();

    rerender(<TourSpotlight {...props} note="Hoy no se puede pedir, así que te llevamos al jueves." />);

    expect(screen.getByText('Hoy no se puede pedir, así que te llevamos al jueves.')).toBeInTheDocument();
  });
});
