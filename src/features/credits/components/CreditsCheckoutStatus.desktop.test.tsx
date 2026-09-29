import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CreditsCheckoutStatus } from './CreditsCheckoutStatus';
import { getPurchase } from '../services/creditsApi';
import { mockMatchMedia } from '@/test/matchMedia';
import type { CreditPurchase } from '../types';

vi.mock('../services/creditsApi', () => ({
  getPurchase: vi.fn(),
}));

function renderStatus() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <CreditsCheckoutStatus purchaseId="p1" />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function settle() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

const purchase: CreditPurchase = {
  id: 'p1',
  type: 'PACK',
  creditAmount: 10,
  amountCents: 500000,
  currency: 'ARS',
  status: 'PENDING',
  createdAt: '2026-01-01T00:00:00Z',
  creditedAt: null,
  reversedAt: null,
  packNombre: 'Paquete Semana',
};

const statusColumn = () => document.querySelector('[data-column="status"]') as HTMLElement;
const detailsColumn = () => document.querySelector('[data-column="details"]') as HTMLElement;

describe('CreditsCheckoutStatus on desktop (F22d)', () => {
  let media: ReturnType<typeof mockMatchMedia>;
  beforeEach(() => {
    vi.mocked(getPurchase).mockReset();
    vi.useFakeTimers();
    media = mockMatchMedia(true);
  });
  afterEach(() => {
    media.restore();
    vi.useRealTimers();
  });

  it('PENDING: status copy on the left, the 3 steps and the receipt on the right, refreshable', async () => {
    vi.mocked(getPurchase).mockResolvedValue(purchase);
    renderStatus();
    await settle();

    expect(document.querySelector('[data-layout="desktop"]')).toBeInTheDocument();
    const left = within(statusColumn());
    const right = within(detailsColumn());
    expect(left.getByRole('heading', { level: 1, name: 'Estamos confirmando tu pago' })).toBeInTheDocument();
    expect(left.getByText(/no hace falta que pagues de nuevo/i)).toBeInTheDocument();
    expect(left.getByText(/estamos procesando tu pago/i)).toBeInTheDocument();
    expect(right.getByRole('list', { name: 'Estado de la compra' })).toBeInTheDocument();
    expect(right.getByText('Confirmación de Mercado Pago')).toBeInTheDocument();
    expect(right.getByText('Paquete Semana')).toBeInTheDocument();
    expect(right.getByText('Total')).toBeInTheDocument();
    expect(left.getByRole('link', { name: 'Volver a mis almuerzos' })).toHaveAttribute('href', '/credits');
    expect(screen.queryByText(/se acreditaron/i)).not.toBeInTheDocument();

    expect(getPurchase).toHaveBeenCalledTimes(1);
    fireEvent.click(left.getByRole('button', { name: 'Actualizar estado' }));
    await settle();
    expect(getPurchase).toHaveBeenCalledTimes(2);
  });

  it('APPROVED (pack): title, credited line and CTAs on the left, the receipt on the right, no steps', async () => {
    vi.mocked(getPurchase).mockResolvedValue({ ...purchase, status: 'APPROVED', creditedAt: '2026-01-01T00:05:00Z' });
    renderStatus();
    await settle();

    const left = within(statusColumn());
    const right = within(detailsColumn());
    expect(left.getByRole('heading', { level: 1, name: '¡Listo! Sumaste 10 almuerzos' })).toBeInTheDocument();
    expect(left.getByText(/se acreditaron 10 almuerzos en tu billetera/i)).toBeInTheDocument();
    expect(left.getByRole('link', { name: 'Pedir mi almuerzo' })).toHaveAttribute('href', '/orders/today');
    expect(left.getByRole('link', { name: 'Ver mis almuerzos' })).toHaveAttribute('href', '/credits');
    expect(right.getByText('Total pagado')).toBeInTheDocument();
    expect(right.getByText('Paquete Semana')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Estado de la compra' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Actualizar estado' })).not.toBeInTheDocument();
  });

  it('APPROVED (direct payment): no "se acreditaron", the order CTA points to Mis pedidos', async () => {
    vi.mocked(getPurchase).mockResolvedValue({ ...purchase, type: 'DIRECT', packNombre: null, status: 'APPROVED' });
    renderStatus();
    await settle();

    const left = within(statusColumn());
    expect(left.getByRole('heading', { level: 1, name: '¡Listo! Tu pedido quedó programado' })).toBeInTheDocument();
    expect(left.getByRole('link', { name: 'Ver mi pedido' })).toHaveAttribute('href', '/orders/mine');
    expect(screen.queryByText(/se acreditaron/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/sumaste/i)).not.toBeInTheDocument();
    expect(within(detailsColumn()).getByText('Compra directa')).toBeInTheDocument();
  });

  it('REJECTED: alert and retry CTA on the left, receipt with "Rechazado" on the right', async () => {
    vi.mocked(getPurchase).mockResolvedValue({ ...purchase, status: 'REJECTED' });
    renderStatus();
    await settle();

    const left = within(statusColumn());
    expect(left.getByRole('heading', { level: 1, name: 'No se pudo completar el pago' })).toBeInTheDocument();
    expect(left.getByRole('alert')).toHaveTextContent('No se acreditó ningún almuerzo');
    expect(left.getByRole('link', { name: 'Intentar de nuevo' })).toHaveAttribute('href', '/credits/packs');
    expect(within(detailsColumn()).getByText('Rechazado')).toBeInTheDocument();
  });

  it('REJECTED (direct payment): "Volver a pedir" instead of the pack retry', async () => {
    vi.mocked(getPurchase).mockResolvedValue({ ...purchase, type: 'DIRECT', packNombre: null, status: 'CANCELLED' });
    renderStatus();
    await settle();

    const left = within(statusColumn());
    expect(left.getByRole('link', { name: 'Volver a pedir' })).toHaveAttribute('href', '/orders/today');
    expect(screen.queryByRole('link', { name: 'Intentar de nuevo' })).not.toBeInTheDocument();
  });

  it('IN_MEDIATION: review copy and hold line on the left, receipt on the right', async () => {
    vi.mocked(getPurchase).mockResolvedValue({ ...purchase, status: 'IN_MEDIATION' });
    renderStatus();
    await settle();

    const left = within(statusColumn());
    expect(left.getByRole('heading', { level: 1, name: 'Tu pago está en revisión' })).toBeInTheDocument();
    expect(left.getByText(/quedan en espera hasta que se resuelva/i)).toBeInTheDocument();
    expect(left.getByRole('link', { name: 'Volver a mis almuerzos' })).toHaveAttribute('href', '/credits');
    expect(left.getByRole('link', { name: 'Ir al menú' })).toHaveAttribute('href', '/orders/today');
    expect(within(detailsColumn()).getByText('En revisión por Mercado Pago')).toBeInTheDocument();
  });

  it('never says "créditos"', async () => {
    vi.mocked(getPurchase).mockResolvedValue({ ...purchase, status: 'APPROVED' });
    renderStatus();
    await settle();

    expect(screen.queryByText(/crédito/i)).not.toBeInTheDocument();
  });
});

describe('CreditsCheckoutStatus on mobile (F22d)', () => {
  let media: ReturnType<typeof mockMatchMedia>;
  beforeEach(() => {
    vi.mocked(getPurchase).mockReset();
    vi.useFakeTimers();
    media = mockMatchMedia(false);
  });
  afterEach(() => {
    media.restore();
    vi.useRealTimers();
  });

  it('is unchanged: one centered column, no desktop layout, no refresh button', async () => {
    vi.mocked(getPurchase).mockResolvedValue(purchase);
    renderStatus();
    await settle();

    expect(document.querySelector('[data-layout]')).not.toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Estado de la compra' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Actualizar estado' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Volver a mis almuerzos' })).not.toBeInTheDocument();
  });
});
