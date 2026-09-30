import { act, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CreditsCheckoutReturnPage } from './CreditsCheckoutReturnPage';
import { confirmPurchase, getPurchase } from '@/features/credits/services/creditsApi';
import { mockMatchMedia } from '@/test/matchMedia';

vi.mock('@/features/credits/services/creditsApi', () => ({ getPurchase: vi.fn(), confirmPurchase: vi.fn() }));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/compras/p1/procesando']}>
        <Routes>
          <Route path="/compras/:purchaseId/procesando" element={<CreditsCheckoutReturnPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('CreditsCheckoutReturnPage layout (F22d)', () => {
  let media: ReturnType<typeof mockMatchMedia>;
  beforeEach(() => {
    vi.useFakeTimers();
    // The confirm endpoint is unavailable here, so polling falls back to the plain GET.
    vi.mocked(confirmPurchase).mockRejectedValue(new Error('confirm unavailable'));
    vi.mocked(getPurchase).mockResolvedValue({
      id: 'p1', type: 'PACK', creditAmount: 5, amountCents: 700000, currency: 'ARS', status: 'APPROVED',
      createdAt: '2026-01-01T00:00:00Z', creditedAt: '2026-01-01T00:01:00Z', reversedAt: null,
    });
  });
  afterEach(() => {
    media.restore();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('on desktop the status draws its own full-width band, outside the narrow mobile column', async () => {
    media = mockMatchMedia(true);
    const { container } = renderPage();
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    expect(container.querySelector('[data-layout="desktop"]')).toBeInTheDocument();
    expect(container.querySelector('.max-w-md')).not.toBeInTheDocument();
  });

  it('on mobile keeps the narrow centered column', async () => {
    media = mockMatchMedia(false);
    const { container } = renderPage();
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    expect(container.querySelector('.container.max-w-md')).toBeInTheDocument();
    expect(container.querySelector('[data-layout]')).not.toBeInTheDocument();
  });

  it('keeps the polling budget when the viewport crosses the breakpoint', async () => {
    vi.mocked(getPurchase).mockResolvedValue({
      id: 'p1', type: 'PACK', creditAmount: 5, amountCents: 700000, currency: 'ARS', status: 'PENDING',
      createdAt: '2026-01-01T00:00:00Z', creditedAt: null, reversedAt: null,
    });
    media = mockMatchMedia(false);
    renderPage();
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    // 5 de los 10 intentos en móvil…
    for (let i = 0; i < 5; i++) {
      await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    }
    expect(screen.queryByText(/demorando más de lo esperado/i)).not.toBeInTheDocument();

    // …cruza el corte (rotar / redimensionar) y quedan los otros 5.
    await act(async () => { media.set(true); });
    for (let i = 0; i < 5; i++) {
      await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    }
    expect(screen.getByText(/demorando más de lo esperado/i)).toBeInTheDocument();
  });
});
