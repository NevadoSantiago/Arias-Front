import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { CreditsWalletPage } from './CreditsWalletPage';
import { mockMatchMedia } from '@/test/matchMedia';
import { getMovements, getPacks, getPendingPurchases, getWallet } from '@/features/credits/services/creditsApi';
import { resumeDirectCheckoutV2 } from '@/features/orders/services/ordersApi';
import type { CreditPurchase } from '@/features/credits/types';

vi.mock('@/features/credits/services/creditsApi', () => ({
  getWallet: vi.fn(),
  getMovements: vi.fn(),
  getPacks: vi.fn(),
  createPurchase: vi.fn(),
  getPendingPurchases: vi.fn(),
}));

vi.mock('@/features/orders/services/ordersApi', async () => {
  const actual = await vi.importActual<typeof import('@/features/orders/services/ordersApi')>(
    '@/features/orders/services/ordersApi',
  );
  return { ...actual, resumeDirectCheckoutV2: vi.fn() };
});

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
    vi.mocked(getPendingPurchases).mockResolvedValue([]);
    vi.mocked(getPacks).mockResolvedValue([
      { id: 1, code: 'DAY', packType: 'INDIVIDUAL', nombre: 'Sueltos', creditAmount: 1, priceCents: 150000, discountPercent: 0, ordenDisplay: 1, enabled: true },
      { id: 2, code: 'WEEK', packType: 'SUGERIDO', nombre: 'Paquete Semana', creditAmount: 5, priceCents: 700000, discountPercent: 10, ordenDisplay: 2, enabled: true },
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

const pendingPack: CreditPurchase = {
  id: 'pack-1',
  type: 'PACK',
  creditAmount: 5,
  amountCents: 700000,
  currency: 'ARS',
  status: 'PENDING',
  createdAt: new Date().toISOString(),
  creditedAt: null,
  reversedAt: null,
  packNombre: 'Paquete Semana',
  orderId: null,
  orderEstado: null,
};
const pendingDirect: CreditPurchase = {
  ...pendingPack,
  id: 'dir-1',
  type: 'DIRECT',
  creditAmount: 2,
  amountCents: 300000,
  packNombre: null,
  orderId: 42,
  orderEstado: 'PENDIENTE_PAGO',
};

describe('CreditsWalletPage — pending Mercado Pago payments (D6)', () => {
  let media: ReturnType<typeof mockMatchMedia>;
  beforeEach(() => {
    vi.mocked(getWallet).mockResolvedValue({ available: 12, committed: 1, expiresAt: null });
    vi.mocked(getMovements).mockResolvedValue([]);
    vi.mocked(getPacks).mockResolvedValue([
      { id: 1, code: 'DAY', packType: 'INDIVIDUAL', nombre: 'Sueltos', creditAmount: 1, priceCents: 150000, discountPercent: 0, ordenDisplay: 1, enabled: true },
      { id: 2, code: 'WEEK', packType: 'SUGERIDO', nombre: 'Paquete Semana', creditAmount: 5, priceCents: 700000, discountPercent: 10, ordenDisplay: 2, enabled: true },
    ]);
  });
  afterEach(() => {
    media.restore();
    vi.clearAllMocks();
  });

  const follows = (a: Element, b: Element) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

  it('shows no notice when there is nothing pending', async () => {
    media = mockMatchMedia(false);
    vi.mocked(getPendingPurchases).mockResolvedValue([]);
    renderPage();

    await screen.findByRole('link', { name: /comprar más almuerzos/i });
    await waitFor(() => expect(getPendingPurchases).toHaveBeenCalled());
    expect(screen.queryByRole('region', { name: /pago pendiente|pagos pendientes/i })).not.toBeInTheDocument();
  });

  it('on mobile it sits between the balance card and the history, without touching the available count', async () => {
    media = mockMatchMedia(false);
    vi.mocked(getPendingPurchases).mockResolvedValue([pendingPack]);
    renderPage();

    const region = await screen.findByRole('region', { name: 'Pago pendiente' });
    const buyLink = screen.getByRole('link', { name: /comprar más almuerzos/i });
    expect(follows(buyLink, region)).toBe(true);
    expect(follows(region, screen.getByRole('heading', { name: 'Historial' }))).toBe(true);
    expect(region).toHaveAttribute('data-layout', 'card');

    // Los 5 por acreditar no se suman: el saldo sigue en 12 disponibles y 1 reservado.
    expect(screen.getAllByText('12').length).toBeGreaterThan(0);
    expect(screen.queryByText('17')).not.toBeInTheDocument();
    expect(within(region).getByText('+5 por acreditar')).toBeInTheDocument();
  });

  it('on desktop it goes between the balance and the movements, in its wide layout', async () => {
    media = mockMatchMedia(true);
    vi.mocked(getPendingPurchases).mockResolvedValue([pendingPack]);
    renderPage();

    const region = await screen.findByRole('region', { name: 'Pago pendiente' });
    const balance = await screen.findByRole('region', { name: 'Tu saldo' });
    expect(follows(balance, region)).toBe(true);
    expect(follows(region, screen.getByRole('heading', { name: 'Movimientos' }))).toBe(true);
    expect(region).toHaveAttribute('data-layout', 'wide');
    // Los 5 por acreditar no se suman al saldo.
    expect(within(balance).getAllByText('12').length).toBeGreaterThan(0);
    expect(within(balance).queryByText('17')).not.toBeInTheDocument();
  });

  it('names the pack bought as loose lunches from the catalog (the DAY pack)', async () => {
    media = mockMatchMedia(false);
    vi.mocked(getPendingPurchases).mockResolvedValue([{ ...pendingPack, creditAmount: 3, packNombre: 'Sueltos' }]);
    renderPage();

    expect(await screen.findByText('3 almuerzos sueltos')).toBeInTheDocument();
  });

  it('resumes the payment of an order awaiting payment from "Pagar ahora"', async () => {
    media = mockMatchMedia(false);
    vi.mocked(getPendingPurchases).mockResolvedValue([pendingDirect]);
    vi.mocked(resumeDirectCheckoutV2).mockRejectedValue(new Error('offline'));
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /pagar ahora el pedido #0042/i }));

    await waitFor(() => expect(resumeDirectCheckoutV2).toHaveBeenCalledWith(42));
  });

  it('does not block the page when the pending list fails or is still loading', async () => {
    media = mockMatchMedia(false);
    vi.mocked(getPendingPurchases).mockRejectedValue(new Error('boom'));
    renderPage();

    expect(await screen.findByRole('link', { name: /comprar más almuerzos/i })).toBeInTheDocument();
    await waitFor(() => expect(getPendingPurchases).toHaveBeenCalled());
    expect(screen.queryByRole('region', { name: /pago pendiente|pagos pendientes/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
