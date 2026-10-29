import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { AdminOrdersByPickupPage } from './AdminOrdersByPickupPage';
import {
  getCancelledOrders,
  getOrdersByPickup,
  getPrintAgentStatus,
  getRestaurantConfigAdmin,
  getServerTime,
  markOrdersComandado,
  markOrdersEntregado,
  reprintOrder,
  undoOrderKitchenState,
  type CancelledOrder,
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
    getCancelledOrders: vi.fn(),
    getRestaurantConfigAdmin: vi.fn(),
    getServerTime: vi.fn(),
    markOrdersComandado: vi.fn(),
    markOrdersEntregado: vi.fn(),
    getPrintAgentStatus: vi.fn(),
    reprintOrder: vi.fn(),
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
  pickupLeadMinutes: 60,
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
    printStatus: 'NONE',
    printedAt: null,
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
  vi.mocked(getCancelledOrders).mockResolvedValue([]);
  vi.mocked(getServerTime).mockResolvedValue({ now: at('12:03') });
  vi.mocked(markOrdersEntregado).mockResolvedValue(undefined);
  vi.mocked(undoOrderKitchenState).mockResolvedValue(undefined);
  vi.mocked(getPrintAgentStatus).mockResolvedValue({ lastSeenAt: at('12:02'), online: true });
  vi.mocked(reprintOrder).mockResolvedValue([]);
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('AdminOrdersByPickupPage (kitchen dashboard)', () => {
  it('has no date picker, no Excel export and no "Consolidado de cocina" text', async () => {
    renderPage([]);
    await screen.findByText('No hay pedidos en cocina');
    expect(screen.queryByLabelText(/fecha/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /exportar/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/consolidado/i)).not.toBeInTheDocument();
    expect(getOrdersByPickup).toHaveBeenCalledWith();
  });

  it('shows a friendly empty state in every box and no Confirmados box', async () => {
    renderPage([]);
    expect(await screen.findByText('No hay pedidos en cocina')).toBeInTheDocument();
    expect(screen.getByText('No quedan pedidos programados para hoy.')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /confirmados/i })).not.toBeInTheDocument();
  });

  it('counts down with the server clock, not the PC clock', async () => {
    // The PC says 11:50; the server says 12:03.
    vi.setSystemTime(new Date(at('11:50')));
    renderPage([order(4, 'COMANDADO', '12:10', { comandadoAt: at('11:55') })]);
    const box = await screen.findByRole('region', { name: 'Pedidos comandados' });
    await waitFor(() =>
      expect(within(box).getByTestId('group-header')).toHaveTextContent('12:10 · entrega en 07:00'),
    );
  });

  it('marks a commanded order as delivered and offers a 20 s undo', async () => {
    renderPage([order(4, 'COMANDADO', '12:10', { comandadoAt: at('11:55') })]);
    const box = await screen.findByRole('region', { name: 'Pedidos comandados' });
    fireEvent.click(await within(box).findByRole('button', { name: /entregado.*4/i }));
    await waitFor(() => expect(markOrdersEntregado).toHaveBeenCalledWith([4]));
    expect(await screen.findByText(/pedido n° 4 pasó a entregados/i)).toBeInTheDocument();
    expect(screen.getByText('20 s para deshacer')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /deshacer/i }));
    await waitFor(() => expect(undoOrderKitchenState).toHaveBeenCalledWith(4));
  });

  it('commands a scheduled order now after confirming in the card, with no undo bar', async () => {
    renderPage([order(9, 'PENDIENTE', '13:10')]);
    const box = await screen.findByRole('region', { name: 'Pedidos programados' });
    expect(await within(box).findByText('Retira 13:10 · se comanda 12:10')).toBeInTheDocument();
    fireEvent.click(within(box).getByRole('button', { name: 'Comandar ahora el pedido N° 9' }));
    fireEvent.click(within(box).getByRole('button', { name: 'Sí, comandar' }));
    await waitFor(() => expect(markOrdersComandado).toHaveBeenCalledWith([9]));
    await waitFor(() => expect(getOrdersByPickup).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('button', { name: /deshacer/i })).not.toBeInTheDocument();
  });

  it('moves the order to Comandados with "En cola" after commanding it now', async () => {
    renderPage([order(9, 'PENDIENTE', '13:10')]);
    vi.mocked(getOrdersByPickup).mockResolvedValue([order(9, 'COMANDADO', '13:10', { printStatus: 'QUEUED' })]);
    fireEvent.click(await screen.findByRole('button', { name: 'Comandar ahora el pedido N° 9' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, comandar' }));
    const box = await screen.findByRole('region', { name: 'Pedidos comandados' });
    expect(await within(box).findByText('En cola')).toBeInTheDocument();
    expect(screen.queryByRole('listitem', { name: 'Pedido N° 9' })).not.toBeInTheDocument();
  });

  it('reports a failed "Comandar ahora" without crashing', async () => {
    vi.mocked(markOrdersComandado).mockRejectedValueOnce(new Error('409'));
    renderPage([order(9, 'PENDIENTE', '13:10')]);
    fireEvent.click(await screen.findByRole('button', { name: 'Comandar ahora el pedido N° 9' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, comandar' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: /deshacer/i })).not.toBeInTheDocument();
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

  it('shows the dish and order notes in the commanded and scheduled boxes', async () => {
    const noted = [{ dishNombre: 'Milanesa', sideNombre: 'Papas', creditCost: 1, notas: 'sin sal' }];
    renderPage([
      order(3, 'COMANDADO', '12:30', { comandadoAt: at('12:00'), items: noted, notas: 'timbre roto' }),
      order(9, 'PENDIENTE', '13:10', { items: noted }),
    ]);
    const commanded = await screen.findByRole('region', { name: 'Pedidos comandados' });
    expect(await within(commanded).findByText('sin sal')).toBeInTheDocument();
    expect(within(commanded).getByText('timbre roto')).toBeInTheDocument();
    expect(within(commanded).getByText('1x C/Papas')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Pedidos programados' })).getByText('sin sal')).toBeInTheDocument();
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
    await screen.findByText('No hay pedidos en cocina');
    expect(select.value).toBe('2026-10-01');
    const labels = () => Array.from(select.options).map((o) => o.textContent);
    expect(labels().slice(0, 4)).toEqual(['Hoy', 'Mañana', 'Sáb 3/10', 'Dom 4/10']);
    expect(labels().at(-1)).toBe('Dom 11/10');
    expect(labels()).toHaveLength(11);
    await waitFor(() => expect(labels()).toContain('Mar 6/10 · deshabilitado'));
  });

  it('requests that day when the select changes and keeps it in the URL', async () => {
    renderPage([], { byDay: { [MONDAY]: mondayOrders } });
    await screen.findByText('No hay pedidos en cocina');
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
    renderPage([order(7, 'COMANDADO', '12:20')], { route: `/?dia=${dia}` });
    expect(await screen.findByRole('region', { name: 'Pedidos comandados' })).toBeInTheDocument();
    expect(getOrdersByPickup).not.toHaveBeenCalledWith(dia);
  });

  it('shows only the dish box and the scheduled box, read-only and without "Comandar ahora"', async () => {
    renderPage([order(7, 'COMANDADO', '12:20')], { route: '/?dia=2026-10-05', byDay: { [MONDAY]: mondayOrders } });
    const scheduled = await screen.findByRole('region', { name: /pedidos programados · lunes 5\/10/i });
    expect(screen.getByRole('region', { name: /platos del día · lunes 5\/10/i })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /pedidos comandados/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /entregados/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/se comanda \d/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /comand|entreg|deshacer/i })).not.toBeInTheDocument();
    expect(within(scheduled).getByText(/ese día se comandan solos 60 min antes de cada retiro/i)).toBeInTheDocument();

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
    // The noted Milanesa sits apart from the main count, inside its own box.
    const milanesa = within(box).getByLabelText('Milanesa: 2 en total, 1 con nota');
    expect(within(milanesa).getByText('1 sin acompañamiento')).toBeInTheDocument();
    expect(within(milanesa).getByText('c/ Papas fritas')).toBeInTheDocument();
    expect(within(milanesa).getByText('sin sal')).toBeInTheDocument();
    expect(within(box).getByText('1 c/ Ensalada mixta')).toBeInTheDocument();
  });

  it('shows the compact "no es hoy" line and "Volver a hoy" restores the full board', async () => {
    renderPage([order(7, 'COMANDADO', '12:20')], { route: '/?dia=2026-10-05', byDay: { [MONDAY]: mondayOrders } });
    expect(await screen.findByText(/no es hoy/i)).toHaveTextContent('Estás viendo el lunes 5/10');
    fireEvent.click(screen.getByRole('button', { name: /volver a hoy/i }));
    expect(await screen.findByRole('region', { name: 'Pedidos comandados' })).toBeInTheDocument();
    expect(screen.queryByText(/no es hoy/i)).not.toBeInTheDocument();
    expect(screen.getByTestId('search')).toHaveTextContent(/^$/);
    expect((screen.getByLabelText('Día') as HTMLSelectElement).value).toBe('2026-10-01');
  });

  it('shows no banner nor day boxes on today', async () => {
    renderPage([order(7, 'COMANDADO', '12:20')]);
    await screen.findByRole('region', { name: 'Pedidos comandados' });
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

const cancelledOrder = (id: number, extra: Partial<CancelledOrder> = {}): CancelledOrder => ({
  id,
  customerNickname: `alias${id}`,
  items: [{ dishNombre: 'Milanesa', sideNombre: 'Papas', creditCost: 1, notas: null }],
  notas: null,
  pickupAt: at('13:00'),
  comandadoAt: null,
  cancelledAt: at('12:01'),
  cancelRefunded: true,
  cancelReason: 'CUSTOMER',
  ...extra,
});

describe('AdminOrdersByPickupPage (cancelled orders)', () => {
  it('asks for the cancelled orders of today and shows the collapsed box below Entregados', async () => {
    vi.mocked(getCancelledOrders).mockResolvedValue([cancelledOrder(8), cancelledOrder(9, { comandadoAt: at('11:50') })]);
    renderPage([]);

    const toggle = await screen.findByRole('button', { name: /pedidos cancelados/i });
    expect(getCancelledOrders).toHaveBeenCalledWith('2026-10-01');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(within(toggle).getByText('1 ya comandado')).toBeInTheDocument();
    const delivered = screen.getByRole('button', { name: /pedidos entregados/i });
    expect(delivered.compareDocumentPosition(toggle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('refetches the cancelled orders together with the board on Actualizar', async () => {
    renderPage([]);
    await screen.findByRole('button', { name: /pedidos cancelados/i });
    vi.mocked(getCancelledOrders).mockClear();

    fireEvent.click(screen.getByRole('button', { name: /actualizar/i }));

    await waitFor(() => expect(getCancelledOrders).toHaveBeenCalledTimes(1));
  });

  it('does not show a notice for orders that were already cancelled when the page loaded', async () => {
    vi.mocked(getCancelledOrders).mockResolvedValue([cancelledOrder(8, { comandadoAt: at('11:50') })]);
    renderPage([]);

    await screen.findByRole('button', { name: /pedidos cancelados/i });
    expect(screen.queryByText(/Se canceló el pedido/)).not.toBeInTheDocument();
  });

  it('warns the kitchen when a refresh reveals a newly cancelled order that was already commanded', async () => {
    renderPage([]);
    await screen.findByRole('button', { name: /pedidos cancelados/i });
    vi.mocked(getCancelledOrders).mockResolvedValue([cancelledOrder(12, { customerNickname: 'Juanma', comandadoAt: at('11:50') })]);

    fireEvent.click(screen.getByRole('button', { name: /actualizar/i }));

    const notice = (await screen.findByText(/Se canceló el pedido/)).closest('[role="status"]') as HTMLElement;
    expect(notice).toHaveTextContent('Se canceló el pedido N° 12 · Juanma.');
    expect(notice).toHaveTextContent('descartá la comanda impresa');

    fireEvent.click(within(notice).getByRole('button', { name: 'Ver cancelados' }));
    expect(screen.getByRole('button', { name: /pedidos cancelados/i })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.queryByText(/Se canceló el pedido/)).not.toBeInTheDocument();
    expect(screen.getByText('N° 12')).toBeInTheDocument();
  });

  it('lets the kitchen close the notice', async () => {
    renderPage([]);
    await screen.findByRole('button', { name: /pedidos cancelados/i });
    vi.mocked(getCancelledOrders).mockResolvedValue([cancelledOrder(12, { comandadoAt: at('11:50') })]);
    fireEvent.click(screen.getByRole('button', { name: /actualizar/i }));

    fireEvent.click(await screen.findByRole('button', { name: 'Cerrar aviso' }));

    expect(screen.queryByText(/Se canceló el pedido/)).not.toBeInTheDocument();
  });

  it('does not ask for cancelled orders while another day is shown', async () => {
    const MONDAY = '2026-10-05';
    renderPage([], { route: `/?dia=${MONDAY}` });
    await screen.findByLabelText('Día');
    await waitFor(() => expect(getOrdersByPickup).toHaveBeenCalledWith(MONDAY));

    expect(getCancelledOrders).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /pedidos cancelados/i })).not.toBeInTheDocument();
  });
});

describe('AdminOrdersByPickupPage (printing)', () => {
  it('shows the agent pill in the header', async () => {
    renderPage([]);
    expect(await screen.findByRole('button', { name: /ticketera en línea/i })).toBeInTheDocument();
  });

  it('reprints a failed order, shows the problem banner and brief feedback', async () => {
    renderPage([order(4, 'COMANDADO', '12:10', { comandadoAt: at('11:55'), printStatus: 'FAILED' })]);
    const card = await screen.findByRole('article', { name: /N° 4,/ });
    expect(await screen.findByRole('alert')).toHaveTextContent('1 comanda falló.');

    fireEvent.click(within(card).getByRole('button', { name: /reimprimir comanda/i }));
    await waitFor(() => expect(reprintOrder).toHaveBeenCalledWith(4));
    expect(await within(card).findByRole('button', { name: /reimprimir comanda/i })).toHaveTextContent('Enviada');
  });
});
