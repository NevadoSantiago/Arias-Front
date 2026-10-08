import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
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
import { getDisabledDates } from '@/features/orders/services/ordersApi';

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

vi.mock('@/features/orders/services/ordersApi', async () => {
  const actual = await vi.importActual<typeof import('@/features/orders/services/ordersApi')>(
    '@/features/orders/services/ordersApi',
  );
  return { ...actual, getDisabledDates: vi.fn() };
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

function Search() {
  return <output data-testid="search">{useLocation().search}</output>;
}

interface RenderOptions {
  route?: string;
  /** Orders returned per `fecha`; any other day is empty. */
  byDay?: Record<string, PickupOrder[]>;
  disabled?: { fecha: string; motivo: string | null }[];
  config?: RestaurantConfig;
}

function renderPage(orders: PickupOrder[], opts: RenderOptions = {}) {
  vi.mocked(getOrdersByPickup).mockImplementation(async (fecha?: string) =>
    fecha ? (opts.byDay?.[fecha] ?? []) : orders,
  );
  vi.mocked(getRestaurantConfigAdmin).mockResolvedValue(opts.config ?? config);
  vi.mocked(getDisabledDates).mockResolvedValue(opts.disabled ?? []);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[opts.route ?? '/']}>
        <AdminOrdersByPickupPage />
        <Search />
      </MemoryRouter>
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

  it('shows only the pickup columns that have orders, and the order detail', async () => {
    renderPage([order(7, 'CONFIRMADO', '12:20', { notas: 'sin sal' })]);
    const box = await screen.findByRole('region', { name: /pedidos confirmados para comandar/i });
    expect(within(box).queryByText('12:10')).not.toBeInTheDocument();
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

  describe('one numbered row per dish', () => {
    const twoDishes = (): PickupOrder['items'] => [
      { dishNombre: 'Milanesa', sideNombre: 'puré', creditCost: 1, notas: 'sin sal' },
      { dishNombre: 'Ñoquis', sideNombre: 'salsa rosa', creditCost: 1, notas: 'bien calientes' },
    ];

    /** Both dishes are separate items of one list, each holding only its own note. */
    function expectDishRows(scope: HTMLElement) {
      const row1 = within(scope).getByText('Milanesa c/ puré').closest('li') as HTMLElement;
      const row2 = within(scope).getByText('Ñoquis c/ salsa rosa').closest('li') as HTMLElement;
      expect(row1).not.toBe(row2);
      expect(row1.closest('ol')).not.toBeNull();
      expect(row1.closest('ol')).toBe(row2.closest('ol'));
      expect(within(row1.closest('ol') as HTMLElement).getAllByRole('listitem')).toHaveLength(2);
      expect(within(row1).getByText('sin sal')).toBeInTheDocument();
      expect(within(row1).queryByText('bien calientes')).not.toBeInTheDocument();
      expect(within(row2).getByText('bien calientes')).toBeInTheDocument();
      expect(within(row2).queryByText('sin sal')).not.toBeInTheDocument();
    }

    it('confirmed box: each note sits in the same item as its dish', async () => {
      renderPage([order(7, 'CONFIRMADO', '12:20', { items: twoDishes() })]);
      expectDishRows(await screen.findByRole('region', { name: /pedidos confirmados para comandar/i }));
    });

    it('commanded box: fresh and stale rows list one item per dish', async () => {
      renderPage([
        order(3, 'COMANDADO', '12:30', { comandadoAt: at('12:00'), items: twoDishes() }),
        order(4, 'COMANDADO', '11:10', { comandadoAt: at('11:00'), items: twoDishes() }),
      ]);
      const box = await screen.findByRole('region', { name: /pedidos comandados/i });
      expectDishRows(within(box).getByRole('article'));
      fireEvent.click(within(box).getByRole('button', { name: /retiro hace más de/i }));
      const stale = box.querySelector('#kb-stale-list') as HTMLElement;
      expectDishRows(stale);
      expect(within(box).queryByText(/Milanesa c\/ puré, Ñoquis/)).not.toBeInTheDocument();
    });

    it('scheduled box: each note sits in the same item as its dish', async () => {
      renderPage([order(9, 'PENDIENTE', '13:10', { items: twoDishes() })]);
      expectDishRows(await screen.findByRole('region', { name: /pedidos programados/i }));
    });

    it('delivered box: each note sits in the same item as its dish', async () => {
      renderPage([order(5, 'ENTREGADO', '11:30', { deliveredAt: at('11:41'), items: twoDishes() })]);
      fireEvent.click(await screen.findByRole('button', { name: /pedidos entregados/i }));
      const box = screen.getByRole('region', { name: /pedidos entregados/i });
      expectDishRows(box);
      expect(within(box).queryByText(/Milanesa c\/ puré, Ñoquis/)).not.toBeInTheDocument();
    });

    it('a single dish is also a numbered list item', async () => {
      renderPage([order(7, 'CONFIRMADO', '12:20')]);
      const box = await screen.findByRole('region', { name: /pedidos confirmados para comandar/i });
      const row = within(box).getByText('Milanesa c/ Papas').closest('li') as HTMLElement;
      expect(row.closest('ol')).not.toBeNull();
      expect(within(row).getByText('1')).toBeInTheDocument();
    });

    it('labels the order-level note apart from the dish notes, outside the dish list', async () => {
      renderPage([order(7, 'CONFIRMADO', '12:20', { notas: 'timbre roto', items: twoDishes() })]);
      const box = await screen.findByRole('region', { name: /pedidos confirmados para comandar/i });
      expect(within(box).getByText('Nota del pedido')).toBeInTheDocument();
      expect(within(box).getByText('timbre roto').closest('li')).toBeNull();
    });

    it('shows the order-level note once in a compact row', async () => {
      renderPage([
        order(4, 'COMANDADO', '11:10', { comandadoAt: at('11:00'), notas: 'timbre roto', items: twoDishes() }),
      ]);
      const box = await screen.findByRole('region', { name: /pedidos comandados/i });
      fireEvent.click(within(box).getByRole('button', { name: /retiro hace más de/i }));
      expect(within(box).getByText('Nota del pedido')).toBeInTheDocument();
      expect(within(box).getAllByText('timbre roto')).toHaveLength(1);
    });
  });
});

describe('AdminOrdersByPickupPage — another day', () => {
  // "Today" is Thursday 2026-10-01 (see beforeEach); 2026-10-05 is the next Monday.
  const MONDAY = '2026-10-05';
  const mondayOrders = [
    order(31, 'PENDIENTE', '13:00', {
      notas: 'bien cocida',
      items: [
        { dishNombre: 'Milanesa', sideNombre: 'Papas fritas', creditCost: 1, notas: 'sin sal' },
        { dishNombre: 'Milanesa', sideNombre: null, creditCost: 1, notas: null },
      ],
    }),
    order(30, 'PENDIENTE', '12:00', {
      items: [{ dishNombre: 'Tarta', sideNombre: 'Ensalada mixta', creditCost: 1, notas: null }],
    }),
  ];

  const selectDay = (value: string) => fireEvent.change(screen.getByLabelText('Día'), { target: { value } });

  it('offers Hoy, Mañana and short labels up to Sunday of next week, with Hoy selected', async () => {
    renderPage([], { disabled: [{ fecha: '2026-10-06', motivo: 'Feriado' }] });
    const select = (await screen.findByLabelText('Día')) as HTMLSelectElement;
    await screen.findByText('Nada para comandar ahora');
    expect(select.value).toBe('2026-10-01');
    const labels = () => Array.from(select.options).map((o) => o.textContent);
    expect(labels().slice(0, 4)).toEqual(['Hoy', 'Mañana', 'Sáb 3/10', 'Dom 4/10']);
    expect(labels().at(-1)).toBe('Dom 11/10');
    expect(labels()).toHaveLength(11);
    await waitFor(() => expect(labels()).toContain('Mar 6/10 · deshabilitado'));
  });

  it('requests that day when the select changes and keeps it in the URL', async () => {
    renderPage([], { byDay: { [MONDAY]: mondayOrders } });
    await screen.findByText('Nada para comandar ahora');
    selectDay(MONDAY);
    await waitFor(() => expect(getOrdersByPickup).toHaveBeenCalledWith(MONDAY));
    expect(screen.getByTestId('search')).toHaveTextContent('?dia=2026-10-05');
    expect(await screen.findByRole('region', { name: /platos del día/i })).toBeInTheDocument();
  });

  it('restores the day from the URL', async () => {
    renderPage([], { route: '/?dia=2026-10-05', byDay: { [MONDAY]: mondayOrders } });
    expect(await screen.findByRole('region', { name: /pedidos programados · lunes 5\/10/i })).toBeInTheDocument();
    expect(getOrdersByPickup).toHaveBeenCalledWith(MONDAY);
    expect(getOrdersByPickup).not.toHaveBeenCalledWith();
    expect((screen.getByLabelText('Día') as HTMLSelectElement).value).toBe(MONDAY);
  });

  it.each(['2026-10-30', 'banana', '2026-09-30'])('falls back to today for the invalid value %s', async (dia) => {
    renderPage([order(7, 'CONFIRMADO', '12:20')], { route: `/?dia=${dia}` });
    expect(await screen.findByRole('region', { name: /pedidos confirmados para comandar/i })).toBeInTheDocument();
    expect(getOrdersByPickup).not.toHaveBeenCalledWith(dia);
  });

  it('shows only the dish box and the scheduled box, read-only and without "Se confirma"', async () => {
    renderPage([order(7, 'CONFIRMADO', '12:20')], { route: '/?dia=2026-10-05', byDay: { [MONDAY]: mondayOrders } });
    const scheduled = await screen.findByRole('region', { name: /pedidos programados · lunes 5\/10/i });
    expect(screen.getByRole('region', { name: /platos del día · lunes 5\/10/i })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /confirmados/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /pedidos comandados/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /entregados/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/se confirma \d/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /comand|entreg|deshacer/i })).not.toBeInTheDocument();
    expect(within(scheduled).getByText(/ese día pasan a confirmados 20 min antes de cada retiro/i)).toBeInTheDocument();

    // Sorted by pickup time: N° 30 (12:00) before N° 31 (13:00).
    const rows = within(scheduled).getAllByRole('listitem').filter((li) => /^\d{2}:\d{2}N° \d+/.test(li.textContent ?? ''));
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('N° 30 · alias30');
    expect(rows[1]).toHaveTextContent('N° 31 · alias31');
    expect(within(scheduled).getByText('sin sal')).toBeInTheDocument();
    expect(within(scheduled).getByText('bien cocida')).toBeInTheDocument();
  });

  it('summarizes the dishes of the day', async () => {
    renderPage([], { route: '/?dia=2026-10-05', byDay: { [MONDAY]: mondayOrders } });
    const box = await screen.findByRole('region', { name: /platos del día/i });
    expect(within(box).getByText('3 platos')).toBeInTheDocument();
    expect(within(box).getByText('2 ×')).toBeInTheDocument();
    expect(within(box).getByText('Milanesa')).toBeInTheDocument();
    expect(within(box).getByText('1 c/ Papas fritas · 1 sin acompañamiento')).toBeInTheDocument();
    expect(within(box).getByText('1 c/ Ensalada mixta')).toBeInTheDocument();
  });

  it('shows the compact "no es hoy" line and "Volver a hoy" restores the full board', async () => {
    renderPage([order(7, 'CONFIRMADO', '12:20')], { route: '/?dia=2026-10-05', byDay: { [MONDAY]: mondayOrders } });
    expect(await screen.findByText(/no es hoy/i)).toHaveTextContent('Estás viendo el lunes 5/10');
    fireEvent.click(screen.getByRole('button', { name: /volver a hoy/i }));
    expect(await screen.findByRole('region', { name: /pedidos confirmados para comandar/i })).toBeInTheDocument();
    expect(screen.queryByText(/no es hoy/i)).not.toBeInTheDocument();
    expect(screen.getByTestId('search')).toHaveTextContent(/^$/);
    expect((screen.getByLabelText('Día') as HTMLSelectElement).value).toBe('2026-10-01');
  });

  it('shows no banner nor day boxes on today', async () => {
    renderPage([order(7, 'CONFIRMADO', '12:20')]);
    await screen.findByRole('region', { name: /pedidos confirmados para comandar/i });
    expect(screen.queryByText(/no es hoy/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /platos del día/i })).not.toBeInTheDocument();
    expect(getOrdersByPickup).toHaveBeenCalledWith();
  });

  it('explains an empty open day', async () => {
    renderPage([], { route: '/?dia=2026-10-07' });
    expect(await screen.findByText('No hay pedidos programados para el miércoles 7/10')).toBeInTheDocument();
    expect(screen.getByText(/todavía no hay pedidos para ese día/i)).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /platos del día/i })).not.toBeInTheDocument();
  });

  it('flags a closed weekday', async () => {
    const closedSunday = {
      ...config,
      pickupSchedule: (config.pickupSchedule ?? []).map((d) => ({ ...d, open: d.dayOfWeek !== 7 })),
    };
    renderPage([], { route: '/?dia=2026-10-04', config: closedSunday });
    expect(await screen.findByText(/día cerrado/i)).toBeInTheDocument();
    expect(screen.getByText('No hay pedidos programados para el domingo 4/10')).toBeInTheDocument();
    expect(screen.queryByText(/siguen activos/i)).not.toBeInTheDocument();
  });

  it('flags a disabled date with its reason and says existing orders stay active', async () => {
    renderPage([], {
      route: '/?dia=2026-10-06',
      byDay: { '2026-10-06': mondayOrders },
      disabled: [{ fecha: '2026-10-06', motivo: 'Feriado' }],
    });
    expect(await screen.findByText(/fecha deshabilitada\. motivo: feriado/i)).toBeInTheDocument();
    expect(screen.getByText(/los pedidos que ya existen siguen activos/i)).toBeInTheDocument();
  });

  it('gives the select a stronger border on another day', async () => {
    renderPage([]);
    const select = await screen.findByLabelText('Día');
    const normal = select.className;
    selectDay(MONDAY);
    await waitFor(() => expect(screen.getByLabelText('Día').className).not.toBe(normal));
  });
});
