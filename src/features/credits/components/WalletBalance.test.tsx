import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WalletBalance } from './WalletBalance';
import { getWallet } from '../services/creditsApi';

vi.mock('../services/creditsApi', () => ({
  getWallet: vi.fn(),
}));

function renderWithClient() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <WalletBalance />
    </QueryClientProvider>,
  );
}

describe('WalletBalance', () => {
  it('shows AVAILABLE and COMMITTED as two separate figures, never summed', async () => {
    vi.mocked(getWallet).mockResolvedValueOnce({
      available: 5,
      committed: 2,
      expiresAt: null,
    });

    renderWithClient();

    expect(await screen.findByText('5 disponibles')).toBeInTheDocument();
    expect(screen.getByText('2 comprometidos')).toBeInTheDocument();
    // No single combined total (e.g. "7") should be rendered anywhere.
    expect(screen.queryByText(/^7\b/)).not.toBeInTheDocument();
  });

  it('shows the expiry date with its meaning when the wallet reports one', async () => {
    vi.mocked(getWallet).mockResolvedValueOnce({
      available: 3,
      committed: 0,
      expiresAt: '2026-12-25T00:00:00Z',
    });

    renderWithClient();

    expect(await screen.findByText('3 disponibles')).toBeInTheDocument();
    expect(screen.getByText(/tus almuerzos vencen el/i)).toBeInTheDocument();
  });
});
