import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TourFinalCard, TourWelcomeCard } from './TourCards';

// Los personajes van adentro del cuadro: sin márgenes negativos que los saquen y con recorte.
describe('tour cards keep the characters inside', () => {
  it('welcome card: no negative margin on the illustration, card scrolls on short screens', () => {
    const { container } = render(<TourWelcomeCard title="t" text="x" onStart={vi.fn()} onSkip={vi.fn()} />);

    expect(container.querySelector('img')!.className).not.toMatch(/-mt-/);
    const card = container.querySelector('[role="dialog"]')!;
    expect(card.className).toContain('overflow-y-auto');
    expect(card.className).toContain('pt-6');
  });

  it('final card: no negative margin on the illustration', () => {
    const { container } = render(
      <TourFinalCard title="t" text="x" canOrder onConfirmOrder={vi.fn()} onBrowseMenu={vi.fn()} onPrev={vi.fn()} />,
    );

    expect(container.querySelector('img')!.className).not.toMatch(/-mt-/);
    expect(container.querySelector('[role="dialog"]')!.className).toContain('pt-6');
  });
});
