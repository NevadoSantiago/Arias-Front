import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTargetRect } from './useTargetRect';

const FRAME = 16;

function makeTarget() {
  const el = document.createElement('div');
  el.setAttribute('data-tour', 'dish');
  const box = { top: 100, height: 44 };
  el.getBoundingClientRect = () =>
    ({ left: 20, top: box.top, width: 120, height: box.height, right: 140, bottom: box.top + box.height, x: 20, y: box.top }) as DOMRect;
  const scrollIntoView = vi.fn();
  el.scrollIntoView = scrollIntoView;
  document.body.appendChild(el);
  return { box, scrollIntoView };
}

/** Avanza `ms` de reloj falso en cuadros de animación, dentro de `act`. */
function run(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe('useTargetRect — keeps the target in view', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'Date'] });
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('scrolls the target into view once when it appears', () => {
    const { scrollIntoView } = makeTarget();
    renderHook(() => useTargetRect('dish', 'center'));

    run(FRAME * 3);

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center', inline: 'nearest' });
  });

  it('scrolls again when the layout shift pushes the target out of the viewport', () => {
    const { box, scrollIntoView } = makeTarget();
    renderHook(() => useTargetRect('dish', 'center'));
    run(FRAME * 3);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);

    box.top = 900; // un aviso cargó arriba y empujó el plato fuera de la pantalla
    run(400);

    expect(scrollIntoView).toHaveBeenCalledTimes(2);
    expect(scrollIntoView).toHaveBeenLastCalledWith({ block: 'center', inline: 'nearest' });
  });

  it('does not scroll again while the target stays fully visible', () => {
    const { box, scrollIntoView } = makeTarget();
    renderHook(() => useTargetRect('dish', 'center'));
    run(FRAME * 3);

    box.top = 300;
    run(400);
    box.top = 500;
    run(400);

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it('does not fight a target that stays out of view without moving (e.g. taller than the screen)', () => {
    const { box, scrollIntoView } = makeTarget();
    renderHook(() => useTargetRect('dish', 'center'));
    run(FRAME * 3);

    box.top = 900;
    run(400);
    expect(scrollIntoView).toHaveBeenCalledTimes(2);

    run(1000);

    expect(scrollIntoView).toHaveBeenCalledTimes(2);
  });

  it('throttles repeated re-scrolls to one every 300 ms', () => {
    const { box, scrollIntoView } = makeTarget();
    renderHook(() => useTargetRect('dish', 'center'));
    run(FRAME * 3);

    box.top = 900;
    run(FRAME * 2);
    box.top = 950;
    run(FRAME * 2);
    box.top = 1000;
    run(FRAME * 2);

    // Dentro de los primeros 300 ms del primer scroll no hay un segundo.
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });
});
