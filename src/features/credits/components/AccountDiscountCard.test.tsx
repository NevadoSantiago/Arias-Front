import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AccountDiscountCard } from './AccountDiscountCard';

const inHours = (h: number) => new Date(Date.now() + h * 3_600_000 + 60_000).toISOString();

function renderCard(props: Parameters<typeof AccountDiscountCard>[0]) {
  return render(
    <MemoryRouter>
      <AccountDiscountCard {...props} />
    </MemoryRouter>,
  );
}

describe('AccountDiscountCard', () => {
  it('large: headline, countdown and a "Cargar" link to the purchase flow', () => {
    renderCard({ variant: 'large', discount: { percent: 10, expiresAt: inHours(164) } });

    expect(screen.getByText('Primeros 100')).toBeInTheDocument();
    expect(screen.getByText('Tenés 10% off en tu próxima compra')).toBeInTheDocument();
    expect(screen.getByText(/vence en 6 d 20 h/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /cargar/i })).toHaveAttribute('href', '/credits?comprar=1');
  });

  it('small: a compact link that names the discount and the countdown', () => {
    renderCard({ variant: 'small', discount: { percent: 10, expiresAt: inHours(164) } });

    const link = screen.getByRole('link', { name: /10% off en tu próxima compra/i });
    expect(link).toHaveAttribute('href', '/credits?comprar=1');
    expect(screen.getByText(/vence en 6 d 20 h/i)).toBeInTheDocument();
  });

  it('flags the last day as urgent with hours only', () => {
    renderCard({ variant: 'large', discount: { percent: 10, expiresAt: inHours(5) } });

    expect(screen.getByText(/vence en 5 h/i).className).toContain('font-bold');
  });

  it('renders nothing once expired', () => {
    const { container } = renderCard({ variant: 'large', discount: { percent: 10, expiresAt: '2020-01-01T00:00:00Z' } });
    expect(container).toBeEmptyDOMElement();
  });
});
