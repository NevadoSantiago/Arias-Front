import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { CreditsPacksPage } from './CreditsPacksPage';
import { mockMatchMedia } from '@/test/matchMedia';
import { toast } from 'sonner';
import { createPurchase, getPacks, getWallet } from '@/features/credits/services/creditsApi';
import { getRestaurantConfig } from '@/features/orders/services/ordersApi';
import type { CreditPack } from '@/features/credits/types';

vi.mock('@/features/credits/services/creditsApi', () => ({
  getPacks: vi.fn(),
  createPurchase: vi.fn(),
  getWallet: vi.fn(),
}));
vi.mock('@/features/orders/services/ordersApi', () => ({ getRestaurantConfig: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const dayPack: CreditPack = { id: 1, code: 'DAY', nombre: 'Sueltos', creditAmount: 1, priceCents: 150000, discountPercent: 0, ordenDisplay: 1, enabled: true };
const weekPack: CreditPack = { id: 2, code: 'WEEK', nombre: 'Paquete Semana', creditAmount: 5, priceCents: 700000, discountPercent: 10, ordenDisplay: 2, enabled: true };
const monthPack: CreditPack = { id: 3, code: 'MONTH', nombre: 'Paquete Mes', creditAmount: 20, priceCents: 2400000, discountPercent: 20, ordenDisplay: 3, enabled: true };

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <CreditsPacksPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function arrange() {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-25T12:00:00-03:00'));
  vi.mocked(getPacks).mockResolvedValue([dayPack, weekPack, monthPack]);
  vi.mocked(getWallet).mockResolvedValue({ available: 12, committed: 0, expiresAt: null });
  vi.mocked(getRestaurantConfig).mockResolvedValue({ horaCorte: '10:00', pickupWindowStart: null, pickupWindowEnd: null });
  Object.defineProperty(window, 'location', { writable: true, value: { href: '' } });
}

describe('CreditsPacksPage on desktop (F22c)', () => {
  let media: ReturnType<typeof mockMatchMedia>;
  beforeEach(() => {
    arrange();
    media = mockMatchMedia(true);
  });
  afterEach(() => {
    media.restore();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('lays Sueltos, Semana and Mes out as three side-by-side cards, Semana preselected', async () => {
    renderPage();

    const group = await screen.findByRole('radiogroup', { name: 'Elegí qué comprar' });
    expect(group).toHaveAttribute('data-layout', 'cards');
    const radios = within(group).getAllByRole('radio');
    expect(radios).toHaveLength(3);
    expect(radios[0]).toHaveAccessibleName(/sueltos/i);
    expect(radios[1]).toHaveAccessibleName(/paquete semana/i);
    expect(radios[2]).toHaveAccessibleName(/paquete mes/i);
    expect(radios[1]).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('link', { name: /mis almuerzos/i })).toHaveAttribute('href', '/credits');
  });

  it('shows an always-visible "Tu compra" panel: per-lunch price, discount, total, balance and expiry', async () => {
    renderPage();

    const panel = await screen.findByRole('complementary', { name: 'Tu compra' });
    expect(await within(panel).findByText('Paquete Semana')).toBeInTheDocument();
    expect(panel).toHaveTextContent(/1\.400/);
    expect(panel).toHaveTextContent('−10%');
    expect(panel).toHaveTextContent(/7\.000/);
    expect(panel).toHaveTextContent('Tu saldo pasa de 12 a 17 almuerzos.');
    expect(panel).toHaveTextContent('24 de diciembre de 2026');
    expect(within(panel).queryByRole('button', { name: /continuar/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: /paquete mes/i }));
    expect(panel).toHaveTextContent('−20%');
    expect(panel).toHaveTextContent('Tu saldo pasa de 12 a 32 almuerzos.');
  });

  it('pays straight from the panel with the selected pack', async () => {
    vi.mocked(createPurchase).mockResolvedValueOnce({ purchaseId: 'p1', initPoint: 'https://mp.example/checkout/p1' });
    renderPage();
    const panel = await screen.findByRole('complementary', { name: 'Tu compra' });
    await within(panel).findByText('Paquete Semana');

    fireEvent.click(within(panel).getByRole('button', { name: /pagar con mercado pago/i }));

    await vi.waitFor(() => expect(createPurchase).toHaveBeenCalledWith({ type: 'PACK', packId: 2 }));
    await vi.waitFor(() => expect(window.location.href).toBe('https://mp.example/checkout/p1'));
  });

  it('takes the expiry from the restaurant config, in the date and in the copy (F22c.1)', async () => {
    vi.mocked(getRestaurantConfig).mockResolvedValue({
      horaCorte: '10:00',
      pickupWindowStart: null,
      pickupWindowEnd: null,
      creditExpiryDays: 30,
    });
    renderPage();

    const panel = await screen.findByRole('complementary', { name: 'Tu compra' });
    await vi.waitFor(() => expect(panel).toHaveTextContent('25 de octubre de 2026'));
    expect(screen.getByText(/vencen a los 30 días/i)).toBeInTheDocument();
    expect(screen.queryByText(/90 días/i)).not.toBeInTheDocument();
  });

  it('on a payment error shows a toast and does not redirect', async () => {
    vi.mocked(createPurchase).mockRejectedValueOnce(new Error('boom'));
    renderPage();
    const panel = await screen.findByRole('complementary', { name: 'Tu compra' });
    await within(panel).findByText('Paquete Semana');

    fireEvent.click(within(panel).getByRole('button', { name: /pagar con mercado pago/i }));

    await vi.waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(window.location.href).toBe('');
  });

  it('Sueltos: 1..10 stepper that disables at the limits, priced by DAY x quantity, no discount row', async () => {
    vi.mocked(createPurchase).mockResolvedValueOnce({ purchaseId: 'p2', initPoint: 'https://mp.example/checkout/p2' });
    renderPage();
    fireEvent.click(await screen.findByRole('radio', { name: /sueltos/i }));

    const more = screen.getByRole('button', { name: 'Un almuerzo más' });
    const less = screen.getByRole('button', { name: 'Un almuerzo menos' });
    expect(less).toBeDisabled();
    for (let i = 0; i < 9; i++) fireEvent.click(more);
    expect(more).toBeDisabled();
    fireEvent.click(less);
    fireEvent.click(less);
    fireEvent.click(less);
    fireEvent.click(less);
    fireEvent.click(less);
    fireEvent.click(less);
    fireEvent.click(less); // 3

    const panel = screen.getByRole('complementary', { name: 'Tu compra' });
    expect(panel).toHaveTextContent('Almuerzos sueltos');
    expect(panel).toHaveTextContent(/4\.500/);
    expect(panel).not.toHaveTextContent('Descuento');

    fireEvent.click(within(panel).getByRole('button', { name: /pagar con mercado pago/i }));
    await vi.waitFor(() => expect(createPurchase).toHaveBeenCalledWith({ type: 'PACK', packId: 1, quantity: 3 }));
  });

  it('nudges toward Semana from 4 loose lunches; "Ver paquete" selects it', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('radio', { name: /sueltos/i }));
    const more = screen.getByRole('button', { name: 'Un almuerzo más' });
    fireEvent.click(more);
    fireEvent.click(more);
    expect(screen.queryByRole('button', { name: 'Ver paquete' })).not.toBeInTheDocument();

    fireEvent.click(more);
    fireEvent.click(screen.getByRole('button', { name: 'Ver paquete' }));

    expect(screen.getByRole('radio', { name: /paquete semana/i })).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByRole('button', { name: 'Ver paquete' })).not.toBeInTheDocument();
  });
});

describe('CreditsPacksPage on mobile (F22c)', () => {
  let media: ReturnType<typeof mockMatchMedia>;
  beforeEach(() => {
    arrange();
    media = mockMatchMedia(false);
  });
  afterEach(() => {
    media.restore();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('is unchanged: Sueltos preselected, sticky "Continuar", no "Tu compra" panel', async () => {
    renderPage();

    const radios = await screen.findAllByRole('radio');
    expect(radios[0]).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('button', { name: /^continuar$/i })).toBeInTheDocument();
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Elegí qué comprar' })).not.toHaveAttribute('data-layout');
  });
});
