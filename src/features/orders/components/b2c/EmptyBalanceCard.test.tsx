import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { EmptyBalanceCard } from './EmptyBalanceCard';

describe('EmptyBalanceCard', () => {
  it('shows the empty-balance message and a link to buy lunches', () => {
    render(
      <MemoryRouter>
        <EmptyBalanceCard />
      </MemoryRouter>,
    );

    expect(screen.getByText(/te quedaste sin almuerzos/i)).toBeInTheDocument();
    expect(screen.queryByText(/crédito/i)).not.toBeInTheDocument();

    const link = screen.getByRole('link', { name: /comprar almuerzos/i });
    expect(link).toHaveAttribute('href', '/credits/packs');
  });
});
