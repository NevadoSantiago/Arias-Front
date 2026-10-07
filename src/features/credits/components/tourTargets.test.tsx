import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { WalletBalance } from './WalletBalance';
import { BuyLunchesAside } from './BuyLunchesAside';
import { getWallet } from '../services/creditsApi';
import { getRestaurantConfig } from '@/features/orders/services/ordersApi';

vi.mock('../services/creditsApi', () => ({
  getPacks: vi.fn().mockResolvedValue([]),
  createPurchase: vi.fn(),
  getWallet: vi.fn(),
}));
vi.mock('@/features/orders/services/ordersApi', () => ({ getRestaurantConfig: vi.fn() }));

function renderInApp(ui: React.ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('credits — onboarding tour target for "buy more lunches"', () => {
  it('marks "Comprar más almuerzos" on the mobile wallet card', async () => {
    vi.mocked(getWallet).mockResolvedValue({ available: 1, committed: 0, expiresAt: null });

    renderInApp(<WalletBalance />);

    expect(await screen.findByRole('link', { name: /comprar más almuerzos/i })).toHaveAttribute('data-tour', 'buy');
  });

  it('marks the purchase side panel on desktop, where there is no link to buy', () => {
    vi.mocked(getWallet).mockResolvedValue({ available: 1, committed: 0, expiresAt: null });
    vi.mocked(getRestaurantConfig).mockResolvedValue({} as never);

    const { container } = renderInApp(<BuyLunchesAside />);

    expect(container.querySelector('aside')).toHaveAttribute('data-tour', 'buy');
  });
});
