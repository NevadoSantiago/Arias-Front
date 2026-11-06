import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { GiftDessertCard } from './GiftDessertCard';

const DAY = 86_400_000;
const inDays = (n: number) => new Date(Date.now() + n * DAY).toISOString();

function renderCard(props: Partial<React.ComponentProps<typeof GiftDessertCard>> = {}) {
  const handlers = { onPick: vi.fn(), onRemove: vi.fn() };
  const view = render(<GiftDessertCard pending={null} chosen={null} teaser={null} {...handlers} {...props} />);
  return { ...handlers, ...view };
}

describe('GiftDessertCard', () => {
  it('invites to pick the dessert when one is pending and none is chosen', () => {
    const { onPick } = renderCard({ pending: { expiresAt: inDays(3) } });

    expect(screen.getByText('Tenés un postre de regalo')).toBeInTheDocument();
    expect(screen.getByText(/sumalo a este pedido · vence en 3 días/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /elegir postre/i }));
    expect(onPick).toHaveBeenCalledTimes(1);
  });

  it('shows the chosen dessert as a free line with change and remove actions', () => {
    const { onPick, onRemove } = renderCard({
      pending: { expiresAt: inDays(3) },
      chosen: { nombre: 'Flan casero', fotoUrl: null },
    });

    expect(screen.getByText('Postre de regalo — sin cargo')).toBeInTheDocument();
    expect(screen.getByText('Flan casero')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /cambiar postre/i }));
    expect(onPick).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: /quitar/i }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('shows the teaser, with no actions, when no dessert is pending', () => {
    renderCard({ teaser: 'Te faltan 2 almuerzos para tu postre de regalo.' });

    expect(screen.getByText('Te faltan 2 almuerzos para tu postre de regalo.')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders nothing without a pending dessert or a teaser', () => {
    const { container } = renderCard();

    expect(container).toBeEmptyDOMElement();
  });

  it('explains that the dessert needs a new order when the cart joins an existing one', () => {
    renderCard({ pending: { expiresAt: inDays(3) }, joinsExistingOrder: true });

    expect(screen.getByText(/va en un pedido nuevo/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /elegir postre/i })).not.toBeInTheDocument();
  });
});
