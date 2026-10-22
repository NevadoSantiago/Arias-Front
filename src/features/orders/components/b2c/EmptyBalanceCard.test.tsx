import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { EmptyBalanceCard } from './EmptyBalanceCard';

function renderCard() {
  render(
    <MemoryRouter>
      <EmptyBalanceCard />
    </MemoryRouter>,
  );
}

describe('EmptyBalanceCard', () => {
  it('shows the empty-balance message and a link to buy lunches', () => {
    renderCard();

    expect(
      screen.getByRole('heading', { name: /tu próximo almuerzo te está esperando/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/se te terminaron los almuerzos/i)).toBeInTheDocument();
    expect(screen.queryByText(/crédito/i)).not.toBeInTheDocument();

    const link = screen.getByRole('link', { name: /cargar almuerzos/i });
    expect(link).toHaveAttribute('href', '/credits?comprar=1');
  });

  it('shows the Arias character waiting at the table as decoration', () => {
    renderCard();

    const illustration = screen.getByTestId('empty-balance-illustration');
    expect(illustration).toHaveAttribute('src', expect.stringContaining('EsperandoMesa'));
    expect(illustration).toHaveAttribute('aria-hidden', 'true');
  });
});
