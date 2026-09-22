import { act, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CreditsCheckoutStatus } from './CreditsCheckoutStatus';
import { getPurchase } from '../services/creditsApi';
import type { CreditPurchase } from '../types';

vi.mock('../services/creditsApi', () => ({
  getPurchase: vi.fn(),
}));

function renderWithClient(purchaseId: string | null) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <CreditsCheckoutStatus purchaseId={purchaseId} />
    </QueryClientProvider>,
  );
}

const pendingPurchase: CreditPurchase = {
  id: 'p1',
  type: 'PACK',
  creditAmount: 10,
  amountCents: 500000,
  currency: 'ARS',
  status: 'PENDING',
  createdAt: '2026-01-01T00:00:00Z',
  creditedAt: null,
  reversedAt: null,
};

describe('CreditsCheckoutStatus', () => {
  beforeEach(() => {
    vi.mocked(getPurchase).mockReset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('never claims success while the purchase status is PENDING', async () => {
    vi.mocked(getPurchase).mockResolvedValue(pendingPurchase);

    renderWithClient('p1');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.getByText(/estamos procesando tu pago/i)).toBeInTheDocument();
    expect(screen.queryByText(/se acreditaron/i)).not.toBeInTheDocument();
  });

  it('shows the credited confirmation once the backend reports APPROVED via polling', async () => {
    vi.mocked(getPurchase)
      .mockResolvedValueOnce(pendingPurchase)
      .mockResolvedValueOnce({ ...pendingPurchase, status: 'APPROVED', creditedAt: '2026-01-01T00:05:00Z' });

    renderWithClient('p1');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByText(/estamos procesando tu pago/i)).toBeInTheDocument();

    // Advance past the poll interval so the bounded polling loop refetches.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(screen.getByText(/se acreditaron 10 almuerzos/i)).toBeInTheDocument();
    expect(getPurchase).toHaveBeenCalledTimes(2);
  });

  it('stops polling after the bounded attempt limit and asks the user to wait for an email', async () => {
    vi.mocked(getPurchase).mockResolvedValue(pendingPurchase);

    renderWithClient('p1');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    // 10 poll attempts at 3s each — bounded, must not spin forever.
    for (let i = 0; i < 10; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });
    }

    expect(screen.getByText(/te avisamos por correo/i)).toBeInTheDocument();
    expect(getPurchase).toHaveBeenCalledTimes(11);
  });

  it('shows an error without polling when no purchase id can be resolved from the URL', () => {
    renderWithClient(null);

    expect(screen.getByText(/no pudimos identificar tu compra/i)).toBeInTheDocument();
    expect(getPurchase).not.toHaveBeenCalled();
  });
});
