import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BuyLunchesSheet } from './BuyLunchesSheet';
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
  id: 1, code: 'DAY', packType: 'INDIVIDUAL', nombre: 'Sueltos', creditAmount: 1,
  priceCents: 150000, discountPercent: 0, ordenDisplay: 1, enabled: true, lema: null,
};
const weekPack: CreditPack = {
  id: 2, code: 'WEEK', packType: 'SUGERIDO', nombre: 'Paquete Semana', creditAmount: 5,
  priceCents: 700000, discountPercent: 10, ordenDisplay: 2, enabled: true, lema: null,
};
const monthPack: CreditPack = {
  id: 3, code: 'MONTH', packType: 'OTRO', nombre: 'Paquete Mes', creditAmount: 20,
  priceCents: 2400000, discountPercent: 20, ordenDisplay: 3, enabled: true, lema: null,
};

function renderSheet(open = true, onClose = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <BuyLunchesSheet open={open} onClose={onClose} />
    </QueryClientProvider>,
  );
  return { ...utils, onClose };
}

describe('BuyLunchesSheet', () => {
  beforeEach(() => {
    vi.mocked(getPacks).mockResolvedValue([dayPack, weekPack, monthPack]);
    vi.mocked(getWallet).mockResolvedValue({ available: 12, committed: 0, expiresAt: null });
    vi.mocked(getRestaurantConfig).mockResolvedValue({
      horaCorte: '10:00', pickupWindowStart: null, pickupWindowEnd: null, creditExpiryDays: 45,
    } as never);
    Object.defineProperty(window, 'location', { writable: true, value: { href: '' } });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when closed', () => {
    renderSheet(false);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(getPacks).not.toHaveBeenCalled();
  });

  it('opens as a full-screen dialog titled "Comprar almuerzos"', async () => {
    renderSheet();

    const dialog = await screen.findByRole('dialog', { name: /comprar almuerzos/i });
    expect(dialog.className).toContain('inset-0');
    expect(dialog.className).toContain('rounded-none');
    expect(dialog.className).toContain('h-full');
  });

  it('lists Sueltos first, then the packs, with lemas (or the tagline fallback) and no big count block', async () => {
    vi.mocked(getPacks).mockResolvedValue([dayPack, { ...weekPack, lema: 'Resolvé la semana' }, monthPack]);
    renderSheet();

    const radios = await screen.findAllByRole('radio');
    expect(radios).toHaveLength(3);
    expect(radios[0]).toHaveAccessibleName(/sueltos/i);
    expect(radios[1]).toHaveAccessibleName(/paquete semana/i);
    expect(radios[2]).toHaveAccessibleName(/paquete mes/i);
    expect(within(radios[0]).getByText('Resolvé hoy')).toBeInTheDocument();
    expect(within(radios[1]).getByText('Resolvé la semana')).toBeInTheDocument();
    expect(within(radios[2]).getByText('¡Resolvé todo el mes!')).toBeInTheDocument();
    expect(radios[1]).toHaveAccessibleName(/7\.000/);
    expect(document.querySelector('[data-part="count-block"]')).toBeNull();
  });

  it('shows the homemade "how it works" block before the cards, with the catalog amounts', async () => {
    renderSheet();

    const block = await screen.findByRole('region', { name: /cómo funciona/i });
    const group = screen.getByRole('radiogroup', { name: 'Elegí qué comprar' });
    expect(block.compareDocumentPosition(group) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(block).getByText('Elegí 1, 5 o 20. Cuantos más comprás, menos pagás.')).toBeInTheDocument();
  });

  it('shows the expiry configured by the restaurant and uses icons in the footnotes', async () => {
    renderSheet();

    expect(await screen.findByText(/vencen a los 45 días de tu última compra/i)).toBeInTheDocument();
    expect(screen.queryByText('✓')).not.toBeInTheDocument();
    expect(screen.queryByText('⏱')).not.toBeInTheDocument();
  });

  it('marks the pack with the highest discount as "Mejor opción"', async () => {
    renderSheet();

    await screen.findAllByRole('radio');
    expect(within(screen.getByRole('radio', { name: /paquete mes/i })).getByText('Mejor opción')).toBeInTheDocument();
    expect(within(screen.getByRole('radio', { name: /paquete semana/i })).queryByText('Mejor opción')).not.toBeInTheDocument();
  });

  it('updates the sticky total when the Sueltos quantity changes (price = DAY price × qty)', async () => {
    renderSheet();

    fireEvent.click(await screen.findByRole('radio', { name: /sueltos/i }));
    fireEvent.click(screen.getByRole('button', { name: /un almuerzo más/i }));
    fireEvent.click(screen.getByRole('button', { name: /un almuerzo más/i }));

    expect(await screen.findByText(/4\.500/)).toBeInTheDocument();
  });

  it('opens the review sheet from "Continuar" with the selected pack\'s totals', async () => {
    renderSheet();

    fireEvent.click(await screen.findByRole('radio', { name: /paquete semana/i }));
    fireEvent.click(screen.getByRole('button', { name: /^continuar$/i }));

    const dialog = await screen.findByRole('dialog', { name: /revisá tu compra/i });
    expect(dialog).toHaveTextContent('Tu saldo pasa de 12 a 17 almuerzos.');
  });

  it('pays for a named pack without a quantity and redirects to the checkout initPoint', async () => {
    vi.mocked(createPurchase).mockResolvedValueOnce({ purchaseId: 'p1', initPoint: 'https://mp.example/checkout/p1' });
    renderSheet();

    fireEvent.click(await screen.findByRole('radio', { name: /paquete semana/i }));
    fireEvent.click(screen.getByRole('button', { name: /^continuar$/i }));
    fireEvent.click(await screen.findByRole('button', { name: /pagar con mercado pago/i }));

    await vi.waitFor(() => expect(createPurchase).toHaveBeenCalledWith({ type: 'PACK', packId: 2 }));
    await vi.waitFor(() => expect(window.location.href).toBe('https://mp.example/checkout/p1'));
  });

  it('pays for Sueltos with the chosen quantity', async () => {
    vi.mocked(createPurchase).mockResolvedValueOnce({ purchaseId: 'p2', initPoint: 'https://mp.example/checkout/p2' });
    renderSheet();

    fireEvent.click(await screen.findByRole('radio', { name: /sueltos/i }));
    fireEvent.click(screen.getByRole('button', { name: /un almuerzo más/i }));
    fireEvent.click(screen.getByRole('button', { name: /un almuerzo más/i }));
    fireEvent.click(screen.getByRole('button', { name: /^continuar$/i }));
    fireEvent.click(await screen.findByRole('button', { name: /pagar con mercado pago/i }));

    await vi.waitFor(() => expect(createPurchase).toHaveBeenCalledWith({ type: 'PACK', packId: 1, quantity: 3 }));
  });

  it('sells the named packs, without a Sueltos card, when there is no enabled DAY pack', async () => {
    vi.mocked(createPurchase).mockResolvedValueOnce({ purchaseId: 'p3', initPoint: 'https://mp.example/checkout/p3' });
    vi.mocked(getPacks).mockResolvedValue([weekPack, monthPack]);
    renderSheet();

    expect(await screen.findAllByRole('radio')).toHaveLength(2);
    expect(screen.queryByText('Sueltos')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: /paquete semana/i }));
    fireEvent.click(screen.getByRole('button', { name: /^continuar$/i }));
    fireEvent.click(await screen.findByRole('button', { name: /pagar con mercado pago/i }));

    await vi.waitFor(() => expect(createPurchase).toHaveBeenCalledWith({ type: 'PACK', packId: 2 }));
  });

  it('shows a friendly empty state when the catalog has no enabled packs', async () => {
    vi.mocked(getPacks).mockResolvedValue([]);
    renderSheet();

    expect(await screen.findByText('Todavía no hay paquetes a la venta.')).toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^continuar$/i })).not.toBeInTheDocument();
  });

  it('shows the error message only when the packs query fails', async () => {
    vi.mocked(getPacks).mockRejectedValue(new Error('network down'));
    renderSheet();

    expect(await screen.findByText('No pudimos cargar los paquetes.')).toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  });

  it('calls onClose when the close button is pressed', async () => {
    const { onClose } = renderSheet();

    fireEvent.click(await screen.findByRole('button', { name: 'Cerrar' }));

    expect(onClose).toHaveBeenCalled();
  });
});
