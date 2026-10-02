import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AdminMenuPreviewPage } from './AdminMenuPreviewPage';
import { getDisabledDates, getMenuSections } from '@/features/orders/services/ordersApi';
import {
  getDishCalendar,
  getRestaurantConfigAdmin,
  listDishesAdmin,
  type RestaurantConfig,
} from '@/features/admin/services/adminApi';

vi.mock('@/features/orders/services/ordersApi', () => ({
  getDisabledDates: vi.fn(),
  getMenuSections: vi.fn(),
}));

vi.mock('@/features/admin/services/adminApi', async () => {
  const actual = await vi.importActual<typeof import('@/features/admin/services/adminApi')>(
    '@/features/admin/services/adminApi',
  );
  return {
    ...actual,
    getRestaurantConfigAdmin: vi.fn(),
    listDishesAdmin: vi.fn(),
    getDishCalendar: vi.fn(),
  };
});

const config: RestaurantConfig = {
  horaCorte: '10:00',
  timezone: 'America/Argentina/Buenos_Aires',
  pickupLeadMinutes: 20,
  creditExpiryDays: 90,
  pickupWindowStart: '11:00',
  pickupWindowEnd: '15:00',
  pickupSlotMinutes: 10,
  dailySummaryTime: '08:00',
  pickupReminderMinutes: 25,
  pickupSchedule: [1, 2, 3, 4, 5, 6, 7].map((dayOfWeek) =>
    dayOfWeek === 7
      ? { dayOfWeek, open: false, windowStart: null, windowEnd: null }
      : { dayOfWeek, open: true, windowStart: '11:00', windowEnd: '15:00' },
  ),
};

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AdminMenuPreviewPage />
    </QueryClientProvider>,
  );
}

describe('AdminMenuPreviewPage — pickup hours (F5)', () => {
  beforeEach(() => {
    // Thursday 2026-10-01, 14:00 in Buenos Aires.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-01T17:00:00Z'));
    vi.mocked(getRestaurantConfigAdmin).mockResolvedValue(config);
    vi.mocked(getDisabledDates).mockResolvedValue([]);
    vi.mocked(getMenuSections).mockResolvedValue([]);
    vi.mocked(listDishesAdmin).mockResolvedValue([]);
    vi.mocked(getDishCalendar).mockResolvedValue({});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('shows today\'s B2C window, interval, last slot, with no next-slot line, instead of the order cutoff', async () => {
    renderPage();

    const card = within(await screen.findByRole('region', { name: /retiro en el local/i }));
    expect(card.getByText('11:00 a 15:00')).toBeInTheDocument();
    expect(card.getByText(/cada 10 min/i)).toBeInTheDocument();
    expect(card.getByText(/último horario 14:50/i)).toBeInTheDocument();
    expect(card.queryByText(/próximo horario disponible/i)).not.toBeInTheDocument();
    expect(card.queryByText(/horarios restantes/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/cierre de pedidos/i)).not.toBeInTheDocument();
  });

  it('asks the disabled dates for the schedulable weeks of the restaurant timezone', async () => {
    renderPage();
    await screen.findByRole('region', { name: /retiro en el local/i });

    expect(getDisabledDates).toHaveBeenCalledWith('2026-09-28', '2026-10-11');
  });

  it('shows "no se retiran pedidos" when today is a disabled date', async () => {
    vi.mocked(getDisabledDates).mockResolvedValue([{ fecha: '2026-10-01', motivo: 'Feriado' }]);

    renderPage();

    const card = within(await screen.findByRole('region', { name: /retiro en el local/i }));
    expect(await card.findByText(/hoy no se retiran pedidos/i)).toBeInTheDocument();
    expect(card.getByText(/viernes desde las 11:00/i)).toBeInTheDocument();
  });

  it('shows the week strip with today highlighted and the closed day marked', async () => {
    renderPage();

    const strip = within(await screen.findByRole('list', { name: /horarios de retiro de la semana/i }));
    const items = strip.getAllByRole('listitem');
    expect(items).toHaveLength(7);
    expect(items[3]).toHaveTextContent(/jueves/i);
    expect(items[3]).toHaveTextContent(/hoy/i);
    expect(items[3]).toHaveAttribute('aria-current', 'date');
    expect(items[6]).toHaveTextContent(/domingo/i);
    expect(items[6]).toHaveTextContent(/cerrado/i);
  });
});
