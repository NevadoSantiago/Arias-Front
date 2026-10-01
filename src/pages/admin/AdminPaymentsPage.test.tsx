import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AdminPaymentsPage } from './AdminPaymentsPage';
import { getAdminPayments, type PaymentReport } from '@/features/admin/payments/paymentsApi';
import { getRestaurantConfigAdmin, type RestaurantConfig } from '@/features/admin/services/adminApi';

vi.mock('@/features/admin/payments/paymentsApi', () => ({ getAdminPayments: vi.fn() }));
vi.mock('@/features/admin/services/adminApi', async () => {
  const actual = await vi.importActual<typeof import('@/features/admin/services/adminApi')>(
    '@/features/admin/services/adminApi',
  );
  return { ...actual, getRestaurantConfigAdmin: vi.fn() };
});

const config = { timezone: 'America/Argentina/Buenos_Aires' } as RestaurantConfig;

const report: PaymentReport = {
  rows: [
    {
      purchaseId: 'p1',
      occurredAt: '2026-09-30T16:05:00Z',
      customer: 'Ana Pérez',
      kind: 'SUGERIDO',
      packName: 'Paquete Semana',
      orderId: null,
      credits: 5,
      amountCents: 5000000,
      status: 'APPROVED',
      mpPaymentId: '1111',
      feeCents: 250000,
      netCents: 4750000,
      creditsReversed: 0,
    },
    {
      purchaseId: 'p2',
      occurredAt: '2026-09-29T15:00:00Z',
      customer: 'Beto Gómez',
      kind: 'DIRECT',
      packName: null,
      orderId: 12,
      credits: 1,
      amountCents: 1000000,
      status: 'IN_MEDIATION',
      mpPaymentId: '2222',
      feeCents: null,
      netCents: null,
      creditsReversed: 0,
    },
  ],
  summary: {
    approvedCount: 3,
    grossCents: 11000000,
    feeCents: 550000,
    netCents: 10450000,
    rowsWithoutFee: 1,
    byKind: [
      { kind: 'INDIVIDUAL', count: 1, grossCents: 1000000 },
      { kind: 'SUGERIDO', count: 2, grossCents: 10000000 },
      { kind: 'OTRO', count: 0, grossCents: 0 },
      { kind: 'DIRECT', count: 0, grossCents: 0 },
    ],
    inMediationCount: 1,
    reversedCount: 2,
  },
};

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AdminPaymentsPage />
    </QueryClientProvider>,
  );
}

describe('AdminPaymentsPage', () => {
  beforeEach(() => {
    // Thursday 2026-10-01 14:00 in Buenos Aires.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-01T17:00:00Z'));
    vi.mocked(getRestaurantConfigAdmin).mockResolvedValue(config);
    vi.mocked(getAdminPayments).mockResolvedValue(report);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('defaults to the last 7 days of approved payments in the restaurant timezone', async () => {
    renderPage();
    await screen.findByText('Ana Pérez');
    expect(getAdminPayments).toHaveBeenCalledWith('2026-09-25', '2026-10-01', 'APPROVED');
    expect(screen.getByLabelText('Desde')).toHaveValue('2026-09-25');
    expect(screen.getByLabelText('Hasta')).toHaveValue('2026-10-01');
    expect(screen.getByRole('button', { name: 'Últimos 7 días' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('requests the new range and status when the filters change', async () => {
    renderPage();
    await screen.findByText('Ana Pérez');

    fireEvent.click(screen.getByRole('button', { name: 'Hoy' }));
    await waitFor(() => expect(getAdminPayments).toHaveBeenLastCalledWith('2026-10-01', '2026-10-01', 'APPROVED'));

    fireEvent.click(screen.getByRole('button', { name: 'Últimos 30 días' }));
    await waitFor(() => expect(getAdminPayments).toHaveBeenLastCalledWith('2026-09-02', '2026-10-01', 'APPROVED'));

    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'ALL' } });
    await waitFor(() => expect(getAdminPayments).toHaveBeenLastCalledWith('2026-09-02', '2026-10-01', 'ALL'));

    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-09-10' } });
    await waitFor(() => expect(getAdminPayments).toHaveBeenLastCalledWith('2026-09-10', '2026-10-01', 'ALL'));
  });

  it('shows an error and does not call the API when the range is reversed', async () => {
    renderPage();
    await screen.findByText('Ana Pérez');
    vi.mocked(getAdminPayments).mockClear();

    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-09-01' } });

    expect(await screen.findByRole('alert')).toHaveTextContent(/«Hasta» tiene que ser igual o posterior a «Desde»/);
    expect(getAdminPayments).not.toHaveBeenCalled();
  });

  it('shows the summary boxes with the real Mercado Pago fee and the missing-fee note', async () => {
    renderPage();
    await screen.findByText('Ana Pérez');
    const summary = within(screen.getByRole('region', { name: 'Resumen' }));
    const box = (name: string) => within(summary.getByText(name).parentElement as HTMLElement);

    expect(box('Pagos realizados').getByText('3')).toBeInTheDocument();
    expect(box('Cobrado bruto').getByText(/110\.000,00/)).toBeInTheDocument();
    expect(box('Comisión Mercado Pago').getByText(/5\.500,00/)).toBeInTheDocument();
    expect(box('Ingreso neto').getByText(/104\.500,00/)).toBeInTheDocument();
    expect(screen.getByText('1 pago sin dato de comisión: el neto no lo incluye.')).toBeInTheDocument();
    expect(screen.queryByText(/COMISIÓN MP %/)).not.toBeInTheDocument();
  });

  it('mentions mediation and refunded payments apart from the income', async () => {
    renderPage();
    await screen.findByText('Ana Pérez');
    expect(
      screen.getByText('En este rango además hay 1 pago en mediación y 2 pagos reembolsados, que no suman al ingreso.'),
    ).toBeInTheDocument();
  });

  it('hides the notes when there is nothing to report', async () => {
    vi.mocked(getAdminPayments).mockResolvedValue({
      ...report,
      summary: { ...report.summary, rowsWithoutFee: 0, inMediationCount: 0, reversedCount: 0 },
    });
    renderPage();
    await screen.findByText('Ana Pérez');
    expect(screen.queryByText(/sin dato de comisión/)).not.toBeInTheDocument();
    expect(screen.queryByText(/En este rango además hay/)).not.toBeInTheDocument();
  });

  it('lists every kind in the donut legend with count, share and gross, and shows the share on hover', async () => {
    renderPage();
    await screen.findByText('Ana Pérez');
    const items = within(screen.getByRole('list', { name: 'Pagos por tipo' })).getAllByRole('listitem');
    expect(items).toHaveLength(4);
    expect(items[0]).toHaveTextContent('Individual');
    expect(items[0]).toHaveTextContent('33 %');
    expect(items[1]).toHaveTextContent('Sugerido');
    expect(items[1]).toHaveTextContent('67 %');
    expect(items[1]).toHaveTextContent(/100\.000,00/);
    expect(items[2]).toHaveTextContent('Otro');
    expect(items[2]).toHaveTextContent('0 %');

    const centre = screen.getByTestId('donut-centre');
    expect(centre).toHaveTextContent('3');
    fireEvent.mouseEnter(screen.getByTestId('slice-SUGERIDO'));
    expect(centre).toHaveTextContent('67 %');
    expect(centre).toHaveTextContent('Sugerido');
    fireEvent.mouseLeave(screen.getByTestId('slice-SUGERIDO'));
    expect(centre).toHaveTextContent('3');
    expect(centre).not.toHaveTextContent('67 %');

    fireEvent.focus(screen.getByTestId('slice-INDIVIDUAL'));
    expect(centre).toHaveTextContent('33 %');
  });

  it('renders the payments table in the restaurant timezone with fee, net and Spanish status', async () => {
    renderPage();
    await screen.findByText('Ana Pérez');
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Fecha', 'Cliente', 'Concepto', 'Almuerzos', 'Monto', 'Comisión', 'Neto', 'Estado', 'Pago MP',
    ]);

    const [, first, second] = within(table).getAllByRole('row');
    expect(first).toHaveTextContent('30/09/2026');
    expect(first).toHaveTextContent('13:05');
    expect(first).toHaveTextContent('Sugerido · Paquete Semana');
    expect(first).toHaveTextContent(/50\.000,00/);
    expect(first).toHaveTextContent(/2\.500,00/);
    expect(first).toHaveTextContent(/47\.500,00/);
    expect(first).toHaveTextContent('Aprobado');
    expect(first).toHaveTextContent('1111');

    expect(second).toHaveTextContent('Pago directo · pedido N°12');
    expect(second).toHaveTextContent('En mediación');
    expect(within(second).getAllByText('—')).toHaveLength(2);
  });

  it('shows empty states when there are no payments', async () => {
    vi.mocked(getAdminPayments).mockResolvedValue({
      rows: [],
      summary: {
        ...report.summary,
        approvedCount: 0,
        grossCents: 0,
        feeCents: 0,
        netCents: 0,
        rowsWithoutFee: 0,
        byKind: report.summary.byKind.map((k) => ({ ...k, count: 0, grossCents: 0 })),
        inMediationCount: 0,
        reversedCount: 0,
      },
    });
    renderPage();
    expect(await screen.findByText('No hay pagos para este rango y estado.')).toBeInTheDocument();
    expect(screen.getByText('Sin pagos realizados en este rango.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows a retryable error when the report fails', async () => {
    vi.mocked(getAdminPayments).mockRejectedValueOnce(new Error('boom'));
    renderPage();
    expect(await screen.findByText('No pudimos cargar los pagos.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Ana Pérez')).toBeInTheDocument();
  });
});
