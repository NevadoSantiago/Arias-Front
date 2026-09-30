import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CreditsPacksPage } from './CreditsPacksPage';
import { createPurchase, getPacks, getWallet } from '@/features/credits/services/creditsApi';
import { getRestaurantConfig } from '@/features/orders/services/ordersApi';
import type { CreditPack } from '@/features/credits/types';

vi.mock('@/features/orders/services/ordersApi', () => ({ getRestaurantConfig: vi.fn() }));

vi.mock('@/features/credits/services/creditsApi', () => ({
  getPacks: vi.fn(),
  createPurchase: vi.fn(),
  getWallet: vi.fn(),
}));

const dayPack: CreditPack = {
  id: 1,
  code: 'DAY',
  nombre: 'Sueltos',
  creditAmount: 1,
  priceCents: 150000,
  discountPercent: 0,
  ordenDisplay: 1,
  enabled: true,
};
const weekPack: CreditPack = {
  id: 2,
  code: 'WEEK',
  nombre: 'Paquete Semana',
  creditAmount: 5,
  priceCents: 700000,
  discountPercent: 10,
  ordenDisplay: 2,
  enabled: true,
};
const monthPack: CreditPack = {
  id: 3,
  code: 'MONTH',
  nombre: 'Paquete Mes',
  creditAmount: 20,
  priceCents: 2400000,
  discountPercent: 20,
  ordenDisplay: 3,
  enabled: true,
};

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <CreditsPacksPage />
    </QueryClientProvider>,
  );
}

describe('CreditsPacksPage', () => {
  beforeEach(() => {
    vi.mocked(getPacks).mockResolvedValue([dayPack, weekPack, monthPack]);
    vi.mocked(getWallet).mockResolvedValue({ available: 12, committed: 0, expiresAt: null });
    vi.mocked(getRestaurantConfig).mockResolvedValue({
      horaCorte: '10:00', pickupWindowStart: null, pickupWindowEnd: null, creditExpiryDays: 45,
    } as never);
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { href: '' },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows the expiry configured by the restaurant in the mobile copy', async () => {
    renderPage();

    expect(await screen.findByText(/vencen a los 45 días de tu última compra/i)).toBeInTheDocument();
  });

  it('shows Sueltos first, then the other packs ordered by ordenDisplay, with prices from priceCents', async () => {
    renderPage();

    const radios = await screen.findAllByRole('radio');
    expect(radios).toHaveLength(3);
    expect(radios[0]).toHaveAccessibleName(/sueltos/i);
    expect(radios[1]).toHaveAccessibleName(/paquete semana/i);
    expect(radios[2]).toHaveAccessibleName(/paquete mes/i);

    // DAY: 150000 centavos = $ 1.500,00 (o similar formato ARS) por unidad.
    // Aparece en la tarjeta de Sueltos y, al estar elegida por default, en
    // el resumen fijo de abajo — al menos una vez alcanza para probar que
    // el precio sale de `priceCents`, no hardcodeado.
    expect(screen.getAllByText(/1\.500/).length).toBeGreaterThan(0);
    // WEEK: 700000 centavos = $ 7.000,00.
    expect(screen.getAllByText(/7\.000/).length).toBeGreaterThan(0);
  });

  it('marks the pack with the highest discountPercent as "Recomendado" (documented rule)', async () => {
    renderPage();

    await screen.findAllByRole('radio');
    const monthCard = screen.getByRole('radio', { name: /paquete mes/i });
    expect(within(monthCard).getByText('Recomendado')).toBeInTheDocument();
    const weekCard = screen.getByRole('radio', { name: /paquete semana/i });
    expect(within(weekCard).queryByText('Recomendado')).not.toBeInTheDocument();
  });

  it('updates the sticky total when Sueltos quantity changes (price = DAY price × qty)', async () => {
    renderPage();

    fireEvent.click(await screen.findByRole('radio', { name: /sueltos/i }));
    fireEvent.click(screen.getByRole('button', { name: /un almuerzo más/i }));
    fireEvent.click(screen.getByRole('button', { name: /un almuerzo más/i }));

    // qty = 3 → $ 4.500,00
    expect(await screen.findByText(/4\.500/)).toBeInTheDocument();
  });

  it('opens the review sheet from "Continuar" with the selected pack\'s totals', async () => {
    renderPage();

    fireEvent.click(await screen.findByRole('radio', { name: /paquete semana/i }));
    fireEvent.click(screen.getByRole('button', { name: /^continuar$/i }));

    const dialog = await screen.findByRole('dialog', { name: /revisá tu compra/i });
    // El texto está partido en <strong> para los números — se compara el
    // contenido normalizado del bloque, no un único nodo de texto.
    expect(dialog).toHaveTextContent('Tu saldo pasa de 12 a 17 almuerzos.');
  });

  it('pays for a named pack without a quantity field and redirects to the checkout initPoint', async () => {
    vi.mocked(createPurchase).mockResolvedValueOnce({ purchaseId: 'p1', initPoint: 'https://mp.example/checkout/p1' });
    renderPage();

    fireEvent.click(await screen.findByRole('radio', { name: /paquete semana/i }));
    fireEvent.click(screen.getByRole('button', { name: /^continuar$/i }));
    fireEvent.click(await screen.findByRole('button', { name: /pagar con mercado pago/i }));

    await vi.waitFor(() => expect(createPurchase).toHaveBeenCalledWith({ type: 'PACK', packId: 2 }));
    await vi.waitFor(() => expect(window.location.href).toBe('https://mp.example/checkout/p1'));
  });

  it('pays for Sueltos with the chosen quantity', async () => {
    vi.mocked(createPurchase).mockResolvedValueOnce({ purchaseId: 'p2', initPoint: 'https://mp.example/checkout/p2' });
    renderPage();

    fireEvent.click(await screen.findByRole('radio', { name: /sueltos/i }));
    fireEvent.click(screen.getByRole('button', { name: /un almuerzo más/i }));
    fireEvent.click(screen.getByRole('button', { name: /un almuerzo más/i }));
    fireEvent.click(screen.getByRole('button', { name: /^continuar$/i }));
    fireEvent.click(await screen.findByRole('button', { name: /pagar con mercado pago/i }));

    await vi.waitFor(() => expect(createPurchase).toHaveBeenCalledWith({ type: 'PACK', packId: 1, quantity: 3 }));
  });

  it('lists and sells the named packs, without a Sueltos card, when there is no enabled DAY pack', async () => {
    vi.mocked(createPurchase).mockResolvedValueOnce({ purchaseId: 'p3', initPoint: 'https://mp.example/checkout/p3' });
    vi.mocked(getPacks).mockResolvedValue([weekPack, monthPack]);
    renderPage();

    const radios = await screen.findAllByRole('radio');
    expect(radios).toHaveLength(2);
    expect(screen.queryByText('Sueltos')).not.toBeInTheDocument();
    expect(screen.queryByText(/no pudimos cargar/i)).not.toBeInTheDocument();

    fireEvent.click(await screen.findByRole('radio', { name: /paquete semana/i }));
    fireEvent.click(screen.getByRole('button', { name: /^continuar$/i }));
    fireEvent.click(await screen.findByRole('button', { name: /pagar con mercado pago/i }));

    await vi.waitFor(() => expect(createPurchase).toHaveBeenCalledWith({ type: 'PACK', packId: 2 }));
  });

  it('shows a friendly empty state when the catalog has no enabled packs at all', async () => {
    vi.mocked(getPacks).mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText('Todavía no hay paquetes a la venta.')).toBeInTheDocument();
    expect(screen.queryByText(/no pudimos cargar/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  });

  it('shows the error message only when the packs query fails', async () => {
    vi.mocked(getPacks).mockRejectedValue(new Error('network down'));
    renderPage();

    expect(await screen.findByText('No pudimos cargar los paquetes.')).toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  });
});
