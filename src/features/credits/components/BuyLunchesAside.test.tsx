import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { BuyLunchesAside } from './BuyLunchesAside';
import { createPurchase, getPacks, getWallet } from '../services/creditsApi';
import { getRestaurantConfig } from '@/features/orders/services/ordersApi';
import type { CreditPack } from '../types';

vi.mock('../services/creditsApi', () => ({
  getPacks: vi.fn(),
  createPurchase: vi.fn(),
  getWallet: vi.fn(),
}));
vi.mock('@/features/orders/services/ordersApi', () => ({ getRestaurantConfig: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const dayPack: CreditPack = { id: 1, code: 'DAY', packType: 'INDIVIDUAL', nombre: 'Sueltos', creditAmount: 1, priceCents: 150000, discountPercent: 0, ordenDisplay: 1, enabled: true, lema: null };
const weekPack: CreditPack = { id: 2, code: 'WEEK', packType: 'SUGERIDO', nombre: 'Paquete Semana', creditAmount: 5, priceCents: 700000, discountPercent: 10, ordenDisplay: 2, enabled: true, lema: null };
const monthPack: CreditPack = { id: 3, code: 'MONTH', packType: 'OTRO', nombre: 'Paquete Mes', creditAmount: 20, priceCents: 2400000, discountPercent: 20, ordenDisplay: 3, enabled: true, lema: null };

function Where() {
  return <span data-testid="where">{useLocation().pathname}</span>;
}

function renderAside() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/credits']}>
        <BuyLunchesAside />
        <Where />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const more = () => screen.getByRole('button', { name: 'Un almuerzo más' });
const less = () => screen.getByRole('button', { name: 'Un almuerzo menos' });

describe('BuyLunchesAside with an account discount', () => {
  beforeEach(() => {
    vi.mocked(getPacks).mockResolvedValue([dayPack, weekPack, monthPack]);
    vi.mocked(getWallet).mockResolvedValue({
      available: 12, committed: 1, expiresAt: null, discount: { percent: 10, expiresAt: '2099-01-01T15:00:00Z' },
    });
    vi.mocked(getRestaurantConfig).mockResolvedValue({ horaCorte: '10:00', pickupWindowStart: null, pickupWindowEnd: null });
    Object.defineProperty(window, 'location', { writable: true, value: { href: '' } });
  });
  afterEach(() => vi.clearAllMocks());

  it('discounts the summary total and the buy button label, and pays the unchanged payload', async () => {
    vi.mocked(createPurchase).mockResolvedValueOnce({ purchaseId: 'p1', initPoint: 'https://mp.example/p1' });
    renderAside();

    const summary = await screen.findByTestId('buy-summary');
    expect(summary).toHaveTextContent('$ 6.300');
    expect(within(summary).getByText('$ 7.000').className).toContain('line-through');
    expect(screen.getByText('10% aplicado')).toBeInTheDocument();
    const buy = screen.getByRole('button', { name: /comprar paquete semana · 5 almuerzos por \$\s?6\.300/i });
    fireEvent.click(buy);
    await vi.waitFor(() => expect(createPurchase).toHaveBeenCalledWith({ type: 'PACK', packId: 2 }));
  });
});

describe('BuyLunchesAside', () => {
  beforeEach(() => {
    vi.mocked(getPacks).mockResolvedValue([dayPack, weekPack, monthPack]);
    vi.mocked(getWallet).mockResolvedValue({ available: 12, committed: 1, expiresAt: null });
    vi.mocked(getRestaurantConfig).mockResolvedValue({ horaCorte: '10:00', pickupWindowStart: null, pickupWindowEnd: null });
    Object.defineProperty(window, 'location', { writable: true, value: { href: '' } });
  });
  afterEach(() => vi.clearAllMocks());

  it('offers Sueltos, Semana and Mes as a radio group with Semana preselected, prices from /packs', async () => {
    renderAside();

    const radios = await screen.findAllByRole('radio');
    expect(radios).toHaveLength(3);
    expect(radios[0]).toHaveAccessibleName(/sueltos/i);
    expect(radios[1]).toHaveAccessibleName(/paquete semana/i);
    expect(radios[2]).toHaveAccessibleName(/paquete mes/i);
    expect(radios[1]).toHaveAttribute('aria-checked', 'true');
    expect(radios[0]).toHaveAttribute('aria-checked', 'false');
    expect(radios[1]).toHaveAccessibleName(/7\.000/);
    expect(radios[2]).toHaveAccessibleName(/24\.000/);
    expect(screen.getByRole('complementary', { name: 'Comprar más almuerzos' })).toBeInTheDocument();
  });

  it('shows the homemade "how it works" block between the title and the cards', async () => {
    renderAside();

    const block = await screen.findByRole('region', { name: /cómo funciona/i });
    const title = screen.getByRole('heading', { name: 'Comprar más almuerzos' });
    const group = screen.getByRole('radiogroup');
    expect(title.compareDocumentPosition(block) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(block.compareDocumentPosition(group) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('summarizes the product, the total and the balance change', async () => {
    renderAside();

    const summary = await screen.findByTestId('buy-summary');
    expect(summary).toHaveTextContent('Paquete Semana · 5 almuerzos');
    expect(summary).toHaveTextContent(/7\.000/);
    expect(summary).toHaveTextContent('Tu saldo pasa de 12 a 17 almuerzos.');

    fireEvent.click(screen.getByRole('radio', { name: /paquete mes/i }));
    expect(summary).toHaveTextContent('Tu saldo pasa de 12 a 32 almuerzos.');
  });

  it('buys the selected pack in place: same purchase call and redirect as the Packs page, no navigation', async () => {
    vi.mocked(createPurchase).mockResolvedValueOnce({ purchaseId: 'p1', initPoint: 'https://mp.example/checkout/p1' });
    renderAside();
    await screen.findByTestId('buy-summary');

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^comprar/i }));

    await vi.waitFor(() => expect(createPurchase).toHaveBeenCalledWith({ type: 'PACK', packId: 2 }));
    await vi.waitFor(() => expect(window.location.href).toBe('https://mp.example/checkout/p1'));
    expect(screen.getByTestId('where')).toHaveTextContent('/credits');
  });

  it('renders summary cards: lema (fallback tagline when null), price per lunch, no pack total inside the radiogroup', async () => {
    vi.mocked(getPacks).mockResolvedValue([dayPack, { ...weekPack, lema: 'Para la semana' }, monthPack]);
    renderAside();
    await screen.findByTestId('buy-summary');

    const group = screen.getByRole('radiogroup');
    expect(within(group).getByText('Para la semana')).toBeInTheDocument();
    expect(within(group).getAllByText('Precio por almuerzo')).toHaveLength(3);
    expect(within(group).queryByText(/7\.000/)).not.toBeInTheDocument();
    expect(within(group).queryByText(/24\.000/)).not.toBeInTheDocument();
    expect(within(group).queryByText(/c\/u|ahorrás/)).not.toBeInTheDocument();
    expect(screen.getAllByText(/7\.000/)).toHaveLength(1);
    expect(screen.getByTestId('buy-summary')).toHaveTextContent(/7\.000/);
  });

  it('marks the recommended pack with "Mejor opción"', async () => {
    renderAside();
    await screen.findByTestId('buy-summary');
    expect(screen.getAllByText('Mejor opción')).toHaveLength(1);
  });

  it('changing the Sueltos quantity updates the summary total', async () => {
    renderAside();
    fireEvent.click(await screen.findByRole('radio', { name: /sueltos/i }));
    expect(screen.getByTestId('buy-summary')).toHaveTextContent(/1\.500/);
    fireEvent.click(more());
    expect(screen.getByTestId('buy-summary')).toHaveTextContent(/3\.000/);
  });

  it('shows the Sueltos stepper only when Sueltos is selected, limited to 1..10', async () => {
    renderAside();
    await screen.findAllByRole('radio');
    expect(screen.queryByRole('button', { name: 'Un almuerzo más' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: /sueltos/i }));
    expect(less()).toBeDisabled();
    for (let i = 0; i < 9; i++) fireEvent.click(more());
    expect(more()).toBeDisabled();
    expect(screen.getByText('10')).toBeInTheDocument();
    fireEvent.click(less());
    expect(more()).toBeEnabled();
  });

  it('buys Sueltos with the chosen quantity', async () => {
    vi.mocked(createPurchase).mockResolvedValueOnce({ purchaseId: 'p2', initPoint: 'https://mp.example/checkout/p2' });
    renderAside();
    fireEvent.click(await screen.findByRole('radio', { name: /sueltos/i }));
    fireEvent.click(more());
    fireEvent.click(more());

    expect(screen.getByTestId('buy-summary')).toHaveTextContent('Sueltos · 3 almuerzos');
    fireEvent.click(screen.getByRole('button', { name: /^comprar/i }));

    await vi.waitFor(() => expect(createPurchase).toHaveBeenCalledWith({ type: 'PACK', packId: 1, quantity: 3 }));
  });

  it('nudges toward Semana from 4 loose lunches, and "Elegir paquete" selects it', async () => {
    renderAside();
    fireEvent.click(await screen.findByRole('radio', { name: /sueltos/i }));
    for (let i = 0; i < 2; i++) fireEvent.click(more());
    expect(screen.queryByRole('button', { name: 'Elegir paquete' })).not.toBeInTheDocument();

    fireEvent.click(more());
    expect(screen.getByText(/te sale más barato/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Elegir paquete' }));
    expect(screen.getByRole('radio', { name: /paquete semana/i })).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByRole('button', { name: 'Elegir paquete' })).not.toBeInTheDocument();
  });

  it('tells the customer when the purchase could not start', async () => {
    vi.mocked(createPurchase).mockRejectedValueOnce(new Error('boom'));
    renderAside();
    await screen.findByTestId('buy-summary');

    fireEvent.click(screen.getByRole('button', { name: /^comprar/i }));

    await vi.waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(window.location.href).toBe('');
  });

  it('never says "créditos"', async () => {
    renderAside();
    const summary = await screen.findByTestId('buy-summary');
    // El bloque "¿Cómo funciona?" explica "1 almuerzo = 1 crédito" a propósito; el resto del panel no lo dice.
    expect(within(summary).queryByText(/crédito/i)).not.toBeInTheDocument();
    expect(within(screen.getByRole('radiogroup')).queryByText(/crédito/i)).not.toBeInTheDocument();
  });

  it('no longer repeats the "se suman a tu saldo" and expiry-days notes in the box', async () => {
    renderAside();
    await screen.findByTestId('buy-summary');

    expect(screen.queryByText(/se suman a tu saldo/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/vencen a los/i)).not.toBeInTheDocument();
  });

  it.each([
    ['loading', () => vi.mocked(getPacks).mockReturnValue(new Promise(() => {})), /cargando paquetes/i],
    ['error', () => vi.mocked(getPacks).mockRejectedValue(new Error('boom')), /no pudimos cargar los paquetes/i],
    ['empty catalog', () => vi.mocked(getPacks).mockResolvedValue([]), /todavía no hay paquetes/i],
  ])('shows no radio group and no "Comprar" while %s', async (_name, arrange, message) => {
    arrange();
    renderAside();

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /comprar/i })).not.toBeInTheDocument();
  });
});
