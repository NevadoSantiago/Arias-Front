import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AdminOrdersByPickupPage } from './AdminOrdersByPickupPage';
import {
  getOrdersByPickup,
  getRestaurantConfigAdmin,
  markOrdersComandado,
  markOrdersEntregado,
  undoOrderKitchenState,
  type PickupOrder,
  type RestaurantConfig,
} from '@/features/admin/services/adminApi';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/features/admin/services/adminApi', async () => {
  const actual = await vi.importActual<typeof import('@/features/admin/services/adminApi')>(
    '@/features/admin/services/adminApi',
  );
  return {
    ...actual,
    getOrdersByPickup: vi.fn(),
    getRestaurantConfigAdmin: vi.fn(),
    markOrdersComandado: vi.fn(),
    markOrdersEntregado: vi.fn(),
    undoOrderKitchenState: vi.fn(),
  };
});

const config: RestaurantConfig = {
  horaCorte: '10:00',
  timezone: 'America/Argentina/Buenos_Aires',
  pickupLeadMinutes: 20,
  creditExpiryDays: 90,
  pickupWindowStart: '11:00',
  pickupWindowEnd: '23:00',
  pickupSlotMinutes: 10,
  dailySummaryTime: '08:00',
  pickupReminderMinutes: 25,
  pickupSchedule: [1, 2, 3, 4, 5, 6, 7].map((d) => ({
    dayOfWeek: d,
    open: true,
    windowStart: '11:00',
    windowEnd: '23:00',
  })),
};

/** Local HH:MM in Buenos Aires -> ISO instant for 2026-10-01. */
const at = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(Date.UTC(2026, 9, 1, h + 3, m)).toISOString();
};

function order(
  id: number,
  estado: PickupOrder['estado'],
  pickup: string,
  extra: Partial<PickupOrder> = {},
): PickupOrder {
  return {
    id,
    customerNickname: `alias${id}`,
    items: [{ dishNombre: 'Milanesa', sideNombre: 'Papas', creditCost: 1, notas: null }],
    notas: null,
    estado,
    pickupAt: at(pickup),
    comandadoAt: null,
    deliveredAt: null,
    ...extra,
  };
}

function renderPage(orders: PickupOrder[]) {
  vi.mocked(getOrdersByPickup).mockResolvedValue(orders);
  vi.mocked(getRestaurantConfigAdmin).mockResolvedValue(config);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AdminOrdersByPickupPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  // Only Date is faked: timers, promises and polling keep running for real.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(at('12:03')));
  vi.mocked(markOrdersComandado).mockResolvedValue(undefined);
  vi.mocked(markOrdersEntregado).mockResolvedValue(undefined);
  vi.mocked(undoOrderKitchenState).mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('AdminOrdersByPickupPage (kitchen dashboard)', () => {
  it('has no date picker, no Excel export and no "Consolidado de cocina" text', async () => {
    renderPage([]);
    await screen.findByText('Nada para comandar ahora');
    expect(screen.queryByLabelText(/fecha/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /exportar/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/consolidado/i)).not.toBeInTheDocument();
    expect(getOrdersByPickup).toHaveBeenCalledWith();
  });

  it('shows a friendly empty state in every box', async () => {
    renderPage([]);
    expect(await screen.findByText('Nada para comandar ahora')).toBeInTheDocument();
    expect(screen.getByText('No hay pedidos en cocina')).toBeInTheDocument();
    expect(screen.getByText('No quedan pedidos programados para hoy.')).toBeInTheDocument();
  });

  it('shows the pickup columns derived from lead and slot, and the order detail', async () => {
    renderPage([order(7, 'CONFIRMADO', '12:20', { notas: 'sin sal' })]);
    const box = await screen.findByRole('region', { name: /pedidos confirmados para comandar/i });
    expect(within(box).getByText('12:10')).toBeInTheDocument();
    expect(within(box).getByText('12:20')).toBeInTheDocument();
    expect(within(box).getByText('Primero')).toBeInTheDocument();
    expect(within(box).getByText(/N° 7 · alias7/)).toBeInTheDocument();
    expect(within(box).getByText('Milanesa c/ Papas')).toBeInTheDocument();
    expect(within(box).getByText('sin sal')).toBeInTheDocument();
  });

  it('commands one order, then undoes it from the bar', async () => {
    renderPage([order(7, 'CONFIRMADO', '12:20')]);
    fireEvent.click(await screen.findByRole('button', { name: /comandado.*7/i }));
    await waitFor(() => expect(markOrdersComandado).toHaveBeenCalledWith([7]));

    expect(await screen.findByText(/pedido n° 7 pasó a comandados/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /deshacer/i }));
    await waitFor(() => expect(undoOrderKitchenState).toHaveBeenCalledWith(7));
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /deshacer/i })).not.toBeInTheDocument(),
    );
  });

  it('commands every order of a slot at once and undoes each id', async () => {
    renderPage([order(1, 'CONFIRMADO', '12:20'), order(2, 'CONFIRMADO', '12:20')]);
    fireEvent.click(await screen.findByRole('button', { name: 'Comandar los 2 de las 12:20' }));
    await waitFor(() => expect(markOrdersComandado).toHaveBeenCalledWith([1, 2]));

    fireEvent.click(await screen.findByRole('button', { name: /deshacer/i }));
    await waitFor(() => expect(undoOrderKitchenState).toHaveBeenCalledTimes(2));
    expect(undoOrderKitchenState).toHaveBeenCalledWith(1);
    expect(undoOrderKitchenState).toHaveBeenCalledWith(2);
  });

  it('does not offer the batch button for a slot with a single order', async () => {
    renderPage([order(1, 'CONFIRMADO', '12:20')]);
    await screen.findByText(/N° 1 · alias1/);
    expect(screen.queryByRole('button', { name: /comandar los/i })).not.toBeInTheDocument();
  });

  it('marks a commanded order as delivered', async () => {
    renderPage([order(4, 'COMANDADO', '12:10', { comandadoAt: at('11:55') })]);
    const box = await screen.findByRole('region', { name: /pedidos comandados/i });
    expect(within(box).getByText(/N° 4/)).toBeInTheDocument();
    expect(within(box).getByText('en 7 min')).toBeInTheDocument();
    fireEvent.click(within(box).getByRole('button', { name: /entregado.*4/i }));
    await waitFor(() => expect(markOrdersEntregado).toHaveBeenCalledWith([4]));
    expect(await screen.findByText(/pedido n° 4 pasó a entregados/i)).toBeInTheDocument();
  });

  it('folds old commanded orders and delivers them all in one go', async () => {
    renderPage([
      order(1, 'COMANDADO', '11:00'),
      order(2, 'COMANDADO', '11:20'),
      order(3, 'COMANDADO', '12:10'),
    ]);
    const toggle = await screen.findByRole('button', { name: /retiro hace más de 30 min \(2\)/i });
    expect(
      screen.queryByRole('button', { name: 'Marcar los 2 como entregados' }),
    ).not.toBeInTheDocument();
    fireEvent.click(toggle);
    fireEvent.click(screen.getByRole('button', { name: 'Marcar los 2 como entregados' }));
    await waitFor(() => expect(markOrdersEntregado).toHaveBeenCalledWith([1, 2]));
  });

  it('lists scheduled orders with the time they get confirmed', async () => {
    renderPage([order(9, 'PENDIENTE', '13:10')]);
    const box = await screen.findByRole('region', { name: /pedidos programados/i });
    expect(within(box).getByText('Se confirma 12:50')).toBeInTheDocument();
    expect(within(box).getByText('13:10')).toBeInTheDocument();
  });

  it('keeps delivered orders collapsed until expanded', async () => {
    renderPage([order(5, 'ENTREGADO', '11:30', { deliveredAt: at('11:41') })]);
    const toggle = await screen.findByRole('button', { name: /pedidos entregados/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText(/alias5/)).not.toBeInTheDocument();
    fireEvent.click(toggle);
    expect(screen.getByText(/alias5/)).toBeInTheDocument();
    expect(screen.getByText(/entregado 11:41/i)).toBeInTheDocument();
  });

  it('reports a failed move without crashing and offers no undo', async () => {
    vi.mocked(markOrdersComandado).mockRejectedValueOnce(new Error('409'));
    renderPage([order(7, 'CONFIRMADO', '12:20')]);
    fireEvent.click(await screen.findByRole('button', { name: /comandado.*7/i }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: /deshacer/i })).not.toBeInTheDocument();
  });

  describe('dish notes and card trimming', () => {
    const noted = (note: string): PickupOrder['items'] => [
      { dishNombre: 'Milanesa', sideNombre: 'Papas', creditCost: 1, notas: note },
    ];

    it('shows the dish note in the confirmed box', async () => {
      renderPage([order(7, 'CONFIRMADO', '12:20', { items: noted('sin sal') })]);
      const box = await screen.findByRole('region', { name: /pedidos confirmados para comandar/i });
      expect(within(box).getByText('sin sal')).toBeInTheDocument();
    });

    it('shows the dish note in the commanded box, fresh and faded rows', async () => {
      renderPage([
        order(3, 'COMANDADO', '12:30', { comandadoAt: at('12:00'), items: noted('bien cocida') }),
        order(4, 'COMANDADO', '11:10', { comandadoAt: at('11:00'), items: noted('sin cebolla') }),
      ]);
      const box = await screen.findByRole('region', { name: /pedidos comandados/i });
      expect(within(box).getByText('bien cocida')).toBeInTheDocument();
      fireEvent.click(within(box).getByRole('button', { name: /retiro hace más de/i }));
      expect(within(box).getByText('sin cebolla')).toBeInTheDocument();
    });

    it('shows the dish note in the scheduled box', async () => {
      renderPage([order(9, 'PENDIENTE', '13:10', { items: noted('aderezo aparte') })]);
      const box = await screen.findByRole('region', { name: /pedidos programados/i });
      expect(within(box).getByText('aderezo aparte')).toBeInTheDocument();
    });

    it('shows the dish note in the delivered box', async () => {
      renderPage([order(5, 'ENTREGADO', '11:30', { deliveredAt: at('11:41'), items: noted('sin sal') })]);
      fireEvent.click(await screen.findByRole('button', { name: /pedidos entregados/i }));
      const box = screen.getByRole('region', { name: /pedidos entregados/i });
      expect(within(box).getByText('sin sal')).toBeInTheDocument();
    });

    it('keeps the order-level note next to the dish notes', async () => {
      renderPage([order(7, 'CONFIRMADO', '12:20', { notas: 'timbre roto', items: noted('sin sal') })]);
      const box = await screen.findByRole('region', { name: /pedidos confirmados para comandar/i });
      expect(within(box).getByText('timbre roto')).toBeInTheDocument();
      expect(within(box).getByText('sin sal')).toBeInTheDocument();
    });

    it('does not print the time the order was commanded', async () => {
      renderPage([order(3, 'COMANDADO', '12:30', { comandadoAt: at('12:00') })]);
      await screen.findByRole('region', { name: /pedidos comandados/i });
      expect(screen.queryByText(/comandado \d{1,2}:\d{2}/i)).not.toBeInTheDocument();
    });
  });
});
