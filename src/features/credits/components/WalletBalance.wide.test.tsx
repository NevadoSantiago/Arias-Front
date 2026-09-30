import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { WalletBalance } from './WalletBalance';
import { getWallet } from '../services/creditsApi';

vi.mock('../services/creditsApi', () => ({ getWallet: vi.fn() }));

function renderBalance(props: Parameters<typeof WalletBalance>[0] = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <WalletBalance {...props} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const wallet = { available: 12, committed: 1, expiresAt: '2026-12-02T12:00:00Z' };

describe('WalletBalance variants (F22c)', () => {
  it('default (mobile): the buy link goes to the Packs page and there is no "Pedir un almuerzo"', async () => {
    vi.mocked(getWallet).mockResolvedValue(wallet);
    renderBalance();

    const buy = await screen.findByRole('link', { name: /comprar más almuerzos/i });
    expect(buy).toHaveAttribute('href', '/credits/packs');
    expect(screen.queryByRole('link', { name: /pedir un almuerzo/i })).not.toBeInTheDocument();
  });

  it('wide (desktop): same figures, no buy link (the aside buys in place), "Pedir un almuerzo" instead', async () => {
    vi.mocked(getWallet).mockResolvedValue(wallet);
    renderBalance({ variant: 'wide' });

    expect(await screen.findByText('Disponibles')).toBeInTheDocument();
    expect(screen.getByText('Reservado')).toBeInTheDocument();
    expect(screen.getByText(/vencen el/i)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /comprar más almuerzos/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /pedir un almuerzo/i })).toHaveAttribute('href', '/orders/today');
    expect(screen.getByRole('region', { name: 'Tu saldo' })).toBeInTheDocument();
  });
});
