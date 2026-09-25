import { act, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CreditsCheckoutStatus } from './CreditsCheckoutStatus';
import { getPurchase } from '../services/creditsApi';
import type { CreditPurchase } from '../types';

vi.mock('../services/creditsApi', () => ({
  getPurchase: vi.fn(),
}));

// F7: los estados ahora incluyen enlaces de navegación (`Link`), por eso el
// render necesita un `MemoryRouter` — el polling/estado en sí no cambió.
function renderWithClient(purchaseId: string | null) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <CreditsCheckoutStatus purchaseId={purchaseId} />
      </MemoryRouter>
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

  // F7: cobertura del restyle — no cambian la lógica de polling/estado de
  // arriba, solo prueban la presentación nueva.
  it('shows the 3-step status list while PENDING', async () => {
    vi.mocked(getPurchase).mockResolvedValue(pendingPurchase);

    renderWithClient('p1');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.getByText('Pago enviado')).toBeInTheDocument();
    expect(screen.getByText('Confirmación de Mercado Pago')).toBeInTheDocument();
    expect(screen.getByText('Almuerzos en tu saldo')).toBeInTheDocument();
  });

  it('offers a retry link to /credits/packs when the payment was rejected', async () => {
    vi.mocked(getPurchase).mockResolvedValue({ ...pendingPurchase, status: 'REJECTED' });

    renderWithClient('p1');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.getByText(/el pago no se pudo completar/i)).toBeInTheDocument();
    const retryLink = screen.getByRole('link', { name: /intentar de nuevo/i });
    expect(retryLink).toHaveAttribute('href', '/credits/packs');
  });

  it('offers links to order and to the wallet once the purchase is approved', async () => {
    vi.mocked(getPurchase).mockResolvedValue({ ...pendingPurchase, status: 'APPROVED', creditedAt: '2026-01-01T00:05:00Z' });

    renderWithClient('p1');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.getByRole('link', { name: /pedir mi almuerzo/i })).toHaveAttribute('href', '/orders/today');
    expect(screen.getByRole('link', { name: /ver mis almuerzos/i })).toHaveAttribute('href', '/credits');
  });

  // F9: `GET /api/v1/credits/purchases/{id}` ahora incluye `packNombre`
  // (backend task B3) — se muestra en vez del texto genérico "Paquete de
  // almuerzos" / "Compra directa" cuando está presente.
  it('shows the pack name instead of the generic label when packNombre is present (APPROVED)', async () => {
    vi.mocked(getPurchase).mockResolvedValue({
      ...pendingPurchase,
      status: 'APPROVED',
      creditedAt: '2026-01-01T00:05:00Z',
      packNombre: 'Paquete Semana',
    });

    renderWithClient('p1');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.getByText('Paquete Semana')).toBeInTheDocument();
    expect(screen.queryByText('Paquete de almuerzos')).not.toBeInTheDocument();
  });

  it('shows the pack name instead of the generic label when packNombre is present (REJECTED)', async () => {
    vi.mocked(getPurchase).mockResolvedValue({
      ...pendingPurchase,
      status: 'REJECTED',
      packNombre: 'Paquete Mes',
    });

    renderWithClient('p1');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.getByText('Paquete Mes')).toBeInTheDocument();
    expect(screen.queryByText('Paquete de almuerzos')).not.toBeInTheDocument();
  });

  it('falls back to the generic pack label when packNombre is null', async () => {
    vi.mocked(getPurchase).mockResolvedValue({
      ...pendingPurchase,
      status: 'APPROVED',
      creditedAt: '2026-01-01T00:05:00Z',
      packNombre: null,
    });

    renderWithClient('p1');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.getByText('Paquete de almuerzos')).toBeInTheDocument();
  });

  it('falls back to the generic direct-purchase label when packNombre is null', async () => {
    vi.mocked(getPurchase).mockResolvedValue({
      ...pendingPurchase,
      type: 'DIRECT',
      status: 'REJECTED',
      packNombre: null,
    });

    renderWithClient('p1');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.getByText('Compra directa')).toBeInTheDocument();
  });
});
