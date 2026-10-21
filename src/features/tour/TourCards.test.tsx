import { fireEvent, render, screen } from '@testing-library/react';
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
      <TourFinalCard title="t" text="x" onDone={vi.fn()} onPrev={vi.fn()} />,
    );

    expect(container.querySelector('img')!.className).not.toMatch(/-mt-/);
    expect(container.querySelector('[role="dialog"]')!.className).toContain('pt-6');
  });

  it('final card: only the primary button and "Anterior", no way to keep browsing', () => {
    render(<TourFinalCard title="t" text="x" onDone={vi.fn()} onPrev={vi.fn()} />);

    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Empezar a pedir', 'Anterior']);
    expect(screen.queryByText(/seguir mirando el menú/i)).not.toBeInTheDocument();
  });

  it('final card: always "Empezar a pedir" and calls the handler', () => {
    const onDone = vi.fn();
    render(<TourFinalCard title="t" text="x" onDone={onDone} onPrev={vi.fn()} />);

    expect(screen.queryByRole('button', { name: 'Entendido' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Empezar a pedir' }));

    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
