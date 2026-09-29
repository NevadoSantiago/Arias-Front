import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { CreditsWalletPage } from './CreditsWalletPage';
import { mockMatchMedia } from '@/test/matchMedia';
import { getMovements, getPacks, getWallet } from '@/features/credits/services/creditsApi';

vi.mock('@/features/credits/services/creditsApi', () => ({
  getWallet: vi.fn(),
  getMovements: vi.fn(),
  getPacks: vi.fn(),
  createPurchase: vi.fn(),
}));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <CreditsWalletPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('CreditsWalletPage', () => {
  let media: ReturnType<typeof mockMatchMedia>;
  beforeEach(() => {
    vi.mocked(getWallet).mockResolvedValue({ available: 12, committed: 1, expiresAt: null });
    vi.mocked(getMovements).mockResolvedValue([]);
    vi.mocked(getPacks).mockResolvedValue([
      { id: 1, code: 'DAY', nombre: 'Sueltos', creditAmount: 1, priceCents: 150000, discountPercent: 0, ordenDisplay: 1, enabled: true },
      { id: 2, code: 'WEEK', nombre: 'Paquete Semana', creditAmount: 5, priceCents: 700000, discountPercent: 10, ordenDisplay: 2, enabled: true },
    ]);
  });
  afterEach(() => {
    media.restore();
    vi.clearAllMocks();
  });

  it('on mobile it is unchanged: balance card with the buy link to Packs, no aside, no catalog request', async () => {
    media = mockMatchMedia(false);
    renderPage();

    expect(await screen.findByRole('link', { name: /comprar más almuerzos/i })).toHaveAttribute('href', '/credits/packs');
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    expect(getPacks).not.toHaveBeenCalled();
  });

  it('on desktop it buys in place from an aside and drops the link to the Packs page', async () => {
    media = mockMatchMedia(true);
    renderPage();

    expect(await screen.findByRole('complementary', { name: 'Comprar más almuerzos' })).toBeInTheDocument();
    expect(await screen.findAllByRole('radio')).toHaveLength(2);
    expect(await screen.findByRole('region', { name: 'Tu saldo' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Mis almuerzos' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Movimientos' })).toBeInTheDocument();
    expect(document.querySelector('a[href="/credits/packs"]')).toBeNull();
  });
});
