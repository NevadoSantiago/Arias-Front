import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { toast } from 'sonner';
import { MyOrdersPage } from './MyOrdersPage';
import {
  cancelOrderV2,
  changeOrderPickupTimeV2,
  DirectCheckoutNotResumableError,
  getDisabledDates,
  getOrdersV2,
  getPickupSlots,
  getRestaurantConfig,
  OrderNotModifiableError,
  PickupTimeChangeError,
  removeOrderItemV2,
  resumeDirectCheckoutV2,
} from '@/features/orders/services/ordersApi';
import { getWallet } from '@/features/credits/services/creditsApi';
import { useAuthStore } from '@/features/auth/store/authStore';
import { formatOrderTimeLabel } from '@/features/orders/components/orderDateLabels';
import type { OrderV2 } from '@/features/orders/services/ordersApi';

vi.mock('@/features/orders/services/ordersApi', async () => {
  const actual = await vi.importActual<typeof import('@/features/orders/services/ordersApi')>(
    '@/features/orders/services/ordersApi',
  );
  return {
    ...actual,
    getOrdersV2: vi.fn(),
    cancelOrderV2: vi.fn(),
    changeOrderPickupTimeV2: vi.fn(),
    getPickupSlots: vi.fn(),
    getRestaurantConfig: vi.fn(),
    getDisabledDates: vi.fn(),
    removeOrderItemV2: vi.fn(),
    resumeDirectCheckoutV2: vi.fn(),
  };
});

vi.mock('@/features/credits/services/creditsApi', () => ({
  getWallet: vi.fn(),
}));

// No hay <Toaster/> montado en los tests: se mockea para poder afirmar que ya no se usa.
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

/** Jueves 24 de septiembre de 2026, 11:40 en Buenos Aires — el "ahora" del tablero de diseño. */
const NOW = new Date('2026-09-24T11:40:00-03:00');

const baseOrder: OrderV2 = {
  id: 0,
  fecha: '2026-09-25',
  pickupAt: '2026-09-25T13:00:00-03:00',
  estado: 'PENDIENTE',
  creditTotal: 2,
  notas: null,
  items: [
    { id: 1, dishId: 10, dishNombre: 'Milanesa', dishCategoria: 'Premium', sideId: 5, sideNombre: 'Puré', creditCost: 1, notas: null },
    { id: 2, dishId: 11, dishNombre: 'Ensalada', dishCategoria: 'Básico', sideId: null, sideNombre: null, creditCost: 1, notas: null },
  ],
  cancellable: true,
  modifiable: true,
  pickupTimeChangeable: true,
  paidWithMercadoPago: false,
  creditsFromBalance: 0,
};

const order = (id: number, pickupAt: string, extra: Partial<OrderV2> = {}): OrderV2 => ({
  ...baseOrder,
  id,
  fecha: pickupAt.slice(0, 10),
  pickupAt,
  ...extra,
});

const closed: Partial<OrderV2> = { cancellable: false, modifiable: false, pickupTimeChangeable: false };

/** Viernes 25, 13:00, programado y modificable. */
const friday = order(202, '2026-09-25T13:00:00-03:00');
/** Hoy 12:00, ya confirmado (en preparación). */
const todayConfirmed = order(201, '2026-09-24T12:00:00-03:00', { estado: 'CONFIRMADO', ...closed });
/** Hoy 13:00, esperando el pago de Mercado Pago. */
const todayAwaiting = order(205, '2026-09-24T13:00:00-03:00', {
  estado: 'PENDIENTE_PAGO',
  paidWithMercadoPago: true,
  modifiable: false,
  pickupTimeChangeable: false,
});
const monday = order(206, '2026-09-28T12:30:00-03:00', { creditTotal: 1, items: [baseOrder.items[0]] });
const tuesday = order(203, '2026-09-29T12:30:00-03:00', { creditTotal: 1, items: [baseOrder.items[1]] });
const pastConfirmed = order(198, '2026-09-22T13:10:00-03:00', { estado: 'CONFIRMADO', ...closed });
const pastCancelled = order(195, '2026-09-18T12:00:00-03:00', { estado: 'CANCELADO', ...closed });

const MON_TO_FRI_SCHEDULE = [1, 2, 3, 4, 5, 6, 7].map((dayOfWeek) => ({
  dayOfWeek,
  open: dayOfWeek <= 5,
  windowStart: dayOfWeek <= 5 ? '11:00' : null,
  windowEnd: dayOfWeek <= 5 ? '23:00' : null,
}));

function arrangeConfig(schedule = MON_TO_FRI_SCHEDULE) {
  vi.mocked(getRestaurantConfig).mockResolvedValue({
    horaCorte: '10:00',
    pickupWindowStart: null,
    pickupWindowEnd: null,
    pickupLeadMinutes: 20,
    pickupSchedule: schedule,
  });
}

function renderAt(entry = '/orders/mine', queryClient?: QueryClient) {
  const client =
    queryClient ?? new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[entry]}>
        <MyOrdersPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...view, queryClient: client };
}

const renderPage = () => renderAt();

/** El encabezado de la fila de un pedido, por su hora de retiro. */
const rowHeader = async (pattern: RegExp) => screen.findByRole('button', { name: pattern });
const openRow = async (pattern: RegExp) => {
  const head = await rowHeader(pattern);
  if (head.getAttribute('aria-expanded') !== 'true') fireEvent.click(head);
  return screen.findByRole('region', { name: pattern });
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  vi.mocked(getWallet).mockResolvedValue({ available: 8, committed: 4, expiresAt: null });
  vi.mocked(getDisabledDates).mockResolvedValue([]);
  arrangeConfig();
  useAuthStore.setState({
    accessToken: 'token',
    user: {
      id: 7,
      email: 'sofi@example.com',
      firstName: 'Sofía',
      lastName: null,
      nickname: 'Sofi',
      displayName: 'Sofi',
      role: 'EMPLOYEE',
      companyId: null,
      companyName: null,
      categoryId: null,
      emailVerified: true,
      profileComplete: true,
    },
    bootstrapping: false,
  });
});

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  useAuthStore.setState({ accessToken: null, user: null, bootstrapping: true });
});

describe('MyOrdersPage — empty and error states', () => {
  it('shows an empty state pointing to ordering when there are no orders', async () => {
    vi.mocked(getOrdersV2).mockResolvedValueOnce([]);

    renderPage();

    expect(await screen.findByText(/todavía no hiciste ningún pedido/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /hacer mi primer pedido/i })).toHaveAttribute('href', '/orders/today');
  });

  it('shows the footer note about the last 30 orders when there is at least one order', async () => {
    vi.mocked(getOrdersV2).mockResolvedValueOnce([friday]);

    renderPage();

    expect(await screen.findByText('Mostramos tus últimos 30 pedidos.')).toBeInTheDocument();
  });
});

describe('MyOrdersPage — by week and day (F29)', () => {
  it('groups the orders of this week under their day, with "Hoy" on today', async () => {
    vi.mocked(getOrdersV2).mockResolvedValue([friday, todayConfirmed]);
    renderPage();

    const today = await screen.findByRole('heading', { name: /jueves 24/i });
    expect(within(today).getByText('Hoy')).toBeInTheDocument();
    const todayList = screen.getByRole('list', { name: 'Jueves 24' });
    expect(within(todayList).getByRole('button', { name: /retiro 12:00 hs/i })).toBeInTheDocument();
    const fridayList = screen.getByRole('list', { name: 'Viernes 25' });
    expect(within(fridayList).getByRole('button', { name: /retiro 13:00 hs/i })).toBeInTheDocument();
  });

  it('shows the switch with each week dates and order count, and the days of the week that is selected', async () => {
    vi.mocked(getOrdersV2).mockResolvedValue([friday, todayConfirmed, monday]);
    renderPage();

    const esta = await screen.findByRole('button', { name: /esta semana/i });
    const proxima = screen.getByRole('button', { name: /semana próxima/i });
    expect(esta).toHaveAttribute('aria-pressed', 'true');
    expect(within(esta).getByText('21–25 sep')).toBeInTheDocument();
    expect(within(esta).getByText('2')).toBeInTheDocument();
    expect(within(proxima).getByText('28 sep – 2 oct')).toBeInTheDocument();
    expect(within(proxima).getByText('1')).toBeInTheDocument();
    // Solo la semana elegida: los días de la próxima no están.
    expect(screen.queryByRole('heading', { name: /lunes 28/i })).not.toBeInTheDocument();
  });

  it('switches to next week on mobile', async () => {
    vi.mocked(getOrdersV2).mockResolvedValue([friday, monday, tuesday]);
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /semana próxima/i }));

    expect(screen.getByRole('button', { name: /semana próxima/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('list', { name: 'Lunes 28' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Martes 29' })).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Viernes 25' })).not.toBeInTheDocument();
  });

  it('shows the days without orders compact, as "Sin pedidos"', async () => {
    vi.mocked(getOrdersV2).mockResolvedValue([friday, monday]);
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /semana próxima/i }));

    const wednesday = screen.getByRole('heading', { name: /miércoles 30/i }).parentElement as HTMLElement;
    expect(within(wednesday).getByText('Sin pedidos')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Miércoles 30' })).not.toBeInTheDocument();
  });

  it('shows the empty state with "Hacer un pedido" for a week without orders', async () => {
    vi.mocked(getOrdersV2).mockResolvedValue([friday]);
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /semana próxima/i }));

    expect(screen.getByText('No tenés pedidos para la semana próxima')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Hacer un pedido' })).toHaveAttribute('href', '/orders/today');
  });

  it('takes the open weekdays from the restaurant schedule (a closed Tuesday has no day)', async () => {
    arrangeConfig(MON_TO_FRI_SCHEDULE.map((d) => (d.dayOfWeek === 2 ? { ...d, open: false } : d)));
    vi.mocked(getOrdersV2).mockResolvedValue([monday]);
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /semana próxima/i }));

    await waitFor(() => expect(screen.queryByRole('heading', { name: /martes 29/i })).not.toBeInTheDocument());
    expect(screen.getByRole('heading', { name: /lunes 28/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /miércoles 30/i })).toBeInTheDocument();
  });

  it('leaves out the disabled dates', async () => {
    vi.mocked(getDisabledDates).mockResolvedValue([{ fecha: '2026-09-30', motivo: 'Feriado' }]);
    vi.mocked(getOrdersV2).mockResolvedValue([monday]);
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /semana próxima/i }));

    await waitFor(() => expect(screen.queryByRole('heading', { name: /miércoles 30/i })).not.toBeInTheDocument());
    expect(screen.getByRole('heading', { name: /martes 29/i })).toBeInTheDocument();
  });

  it('groups by the Buenos Aires day: an order at 23:30 belongs to that day even though it is already Saturday in UTC', async () => {
    // 2026-09-26T02:30Z = viernes 25 a las 23:30 en Buenos Aires.
    vi.mocked(getOrdersV2).mockResolvedValue([order(300, '2026-09-26T02:30:00Z')]);
    renderPage();

    const fridayList = await screen.findByRole('list', { name: 'Viernes 25' });
    expect(within(fridayList).getByRole('button', { name: /retiro 23:30 hs/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /sábado 26/i })).not.toBeInTheDocument();
  });

  it('folds the past days of this week in one line', async () => {
    vi.mocked(getOrdersV2).mockResolvedValue([friday]);
    renderPage();

    expect(await screen.findByText('Lunes 21 a miércoles 23')).toBeInTheDocument();
  });
});

describe('MyOrdersPage — default view and "Anteriores" (F17)', () => {
  it('hides the past and cancelled orders behind "Ver pedidos anteriores"', async () => {
    vi.mocked(getOrdersV2).mockResolvedValue([friday, pastConfirmed, pastCancelled]);
    renderPage();

    expect(await screen.findByRole('button', { name: /retiro 13:00 hs/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Anteriores' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /retiro 13:10 hs/i })).not.toBeInTheDocument();
  });

  it('reveals "Anteriores" with the date on each row, and hides it again', async () => {
    vi.mocked(getOrdersV2).mockResolvedValue([friday, pastConfirmed, pastCancelled]);
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /ver pedidos anteriores/i }));

    const past = screen.getByRole('heading', { name: 'Anteriores' }).closest('section') as HTMLElement;
    expect(within(past).getByText('Martes 22')).toBeInTheDocument();
    expect(within(past).getByText('Viernes 18')).toBeInTheDocument();
    expect(within(past).getByText('Cancelado')).toBeInTheDocument();
    expect(within(past).getAllByRole('button', { name: /retiro/i })).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: /ocultar pedidos anteriores/i }));
    expect(screen.queryByRole('heading', { name: 'Anteriores' })).not.toBeInTheDocument();
  });

  it('reveals "Anteriores" from the past-days line of this week', async () => {
    vi.mocked(getOrdersV2).mockResolvedValue([friday, pastConfirmed]);
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Ver 1 pedido' }));

    expect(screen.getByRole('heading', { name: 'Anteriores' })).toBeInTheDocument();
  });

  it('keeps a cancelled order out of its day and in "Anteriores", read-only', async () => {
    vi.mocked(getOrdersV2).mockResolvedValue([order(305, '2026-09-25T13:00:00-03:00', { estado: 'CANCELADO', ...closed })]);
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /ver pedidos anteriores/i }));
    const region = await openRow(/retiro 13:00 hs/i);

    expect(within(region).queryByRole('button', { name: /cancelar pedido/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Viernes 25' })).not.toBeInTheDocument();
  });

  it("shows today's confirmed order and a future confirmed one by default", async () => {
    vi.mocked(getOrdersV2).mockResolvedValue([todayConfirmed, order(306, '2026-09-28T13:00:00-03:00', { estado: 'CONFIRMADO', ...closed })]);
    renderPage();

    expect(await screen.findByRole('button', { name: /retiro 12:00 hs/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /semana próxima/i }));
    expect(screen.getByRole('button', { name: /retiro 13:00 hs/i })).toBeInTheDocument();
  });

  it("shows today's order awaiting payment even after its pickup time passed", async () => {
    vi.setSystemTime(new Date('2026-09-24T20:00:00-03:00'));
    vi.mocked(getOrdersV2).mockResolvedValue([todayAwaiting]);
    renderPage();

    expect(await screen.findByRole('button', { name: /retiro 13:00 hs.*pago pendiente/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /ver pedidos anteriores/i })).not.toBeInTheDocument();
  });
});

describe('MyOrdersPage — accordion', () => {
  it('opens one order at a time across the whole page', async () => {
    vi.mocked(getOrdersV2).mockResolvedValue([friday, todayConfirmed]);
    renderPage();

    const region = await openRow(/retiro 13:00 hs/i);
    expect(within(region).getByText('Comanda Nº 0202')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /retiro 12:00 hs/i }));

    expect(screen.getByRole('button', { name: /retiro 12:00 hs/i })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: /retiro 13:00 hs/i })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getAllByTestId('comanda')).toHaveLength(1);
  });

  it('closes the open order when its header is toggled again', async () => {
    vi.mocked(getOrdersV2).mockResolvedValue([friday]);
    renderPage();
    await openRow(/retiro 13:00 hs/i);

    fireEvent.click(screen.getByRole('button', { name: /retiro 13:00 hs/i }));

    expect(screen.queryByTestId('comanda')).not.toBeInTheDocument();
  });

  it('moves between headers with the arrow keys', async () => {
    vi.mocked(getOrdersV2).mockResolvedValue([friday, todayConfirmed]);
    renderPage();

    const first = await screen.findByRole('button', { name: /retiro 12:00 hs/i });
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowDown' });

    expect(screen.getByRole('button', { name: /retiro 13:00 hs/i })).toHaveFocus();
  });

  it('shows the header per state: badge, summary, payment line and note', async () => {
    vi.mocked(getOrdersV2).mockResolvedValue([
      { ...todayAwaiting, creditsFromBalance: 1 },
      todayConfirmed,
      { ...friday, pickupTimeChangeable: false },
    ]);
    renderPage();

    const awaiting = await rowHeader(/retiro 13:00 hs, pago pendiente/i);
    expect(within(awaiting).getByText('2 platos · 2 almuerzos')).toBeInTheDocument();
    expect(within(awaiting).getByText('1 de tu saldo · 1 a pagar, antes de las 12:40')).toBeInTheDocument();
    expect(within(screen.getByRole('button', { name: /retiro 12:00 hs/i })).getByText('Ya lo estamos preparando')).toBeInTheDocument();
    expect(within(screen.getByRole('button', { name: /viernes|retiro 13:00 hs, programado/i })).getByText('Ya no se puede cambiar')).toBeInTheDocument();
  });

  it('opens the comanda with the name they call, the address and the balance', async () => {
    vi.mocked(getOrdersV2).mockResolvedValue([friday]);
    renderPage();

    const region = await openRow(/retiro 13:00 hs/i);

    expect(within(region).getByText('Sofi')).toBeInTheDocument();
    expect(within(region).getByText('11 de Septiembre 4502')).toBeInTheDocument();
    expect(within(region).getByText('Milanesa')).toBeInTheDocument();
    expect(await within(region).findByText('Te quedan 8 almuerzos')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/créditos?\b/i);
  });

  it('falls back to the nickname when the backend does not send displayName', async () => {
    const user = useAuthStore.getState().user!;
    useAuthStore.setState({ user: { ...user, displayName: undefined as unknown as string } });
    vi.mocked(getOrdersV2).mockResolvedValue([friday]);
    renderPage();

    const region = await openRow(/retiro 13:00 hs/i);

    expect(within(region).getByText('Sofi')).toBeInTheDocument();
  });

  it('Programado: "Agregar platos" goes to the order page with the day and the pickup time', async () => {
    vi.mocked(getOrdersV2).mockResolvedValue([friday]);
    renderPage();

    const region = await openRow(/retiro 13:00 hs/i);

    expect(within(region).getByRole('link', { name: /agregar platos/i })).toHaveAttribute(
      'href',
      `/orders/today?fecha=2026-09-25&hora=${encodeURIComponent(friday.pickupAt)}`,
    );
  });

  it('offers the actions only when the backend enables them', async () => {
    vi.mocked(getOrdersV2).mockResolvedValue([friday, todayConfirmed]);
    renderPage();

    const scheduled = await openRow(/retiro 13:00 hs/i);
    expect(within(scheduled).getByRole('button', { name: /^cambiar horario$/i })).toBeInTheDocument();
    expect(within(scheduled).getByRole('button', { name: /^cancelar pedido$/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /retiro 12:00 hs/i }));
    const confirmed = await screen.findByRole('region', { name: /retiro 12:00 hs/i });
    expect(within(confirmed).queryByRole('button', { name: /cancelar pedido|cambiar horario|pagar ahora/i })).not.toBeInTheDocument();
    expect(within(confirmed).queryByRole('link', { name: /agregar platos/i })).not.toBeInTheDocument();
  });
});

describe('MyOrdersPage — cancel', () => {
  it('cancels through the confirmation sheet: refreshes the list and wallet, closes the row and tells at the top', async () => {
    vi.mocked(getOrdersV2)
      .mockResolvedValueOnce([friday])
      .mockResolvedValue([{ ...friday, estado: 'CANCELADO', cancellable: false, modifiable: false, pickupTimeChangeable: false }]);
    vi.mocked(cancelOrderV2).mockResolvedValueOnce(undefined);
    const { queryClient } = renderPage();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    const region = await openRow(/retiro 13:00 hs/i);
    fireEvent.click(within(region).getByRole('button', { name: /^cancelar pedido$/i }));
    expect(await screen.findByText('¿Cancelar este pedido?')).toBeInTheDocument();
    expect(await screen.findByText(/pasás de 8 a 10 almuerzos disponibles/i)).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: /sí, cancelar pedido/i }));

    await waitFor(() => expect(vi.mocked(cancelOrderV2).mock.calls[0]?.[0]).toBe(202));
    const notice = await screen.findByRole('status');
    expect(notice).toHaveTextContent('Pedido cancelado');
    expect(notice).toHaveTextContent('2 almuerzos volvieron a tu saldo');
    expect(toast.success).not.toHaveBeenCalled();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['creditsWallet'] });
    // La fila se cierra y el pedido pasó a "Anteriores".
    await waitFor(() => expect(screen.queryByTestId('comanda')).not.toBeInTheDocument());
    expect(screen.queryByRole('list', { name: 'Viernes 25' })).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: /ver pedidos anteriores/i }));
    expect(await screen.findByText('Cancelado')).toBeInTheDocument();
  });

  it('shows the real count of the cancelled order even if another cancel is requested while it is pending', async () => {
    const other = order(207, '2026-09-25T14:00:00-03:00', { creditTotal: 1, items: [baseOrder.items[0]] });
    vi.mocked(getOrdersV2).mockResolvedValue([friday, other]);
    let resolveCancel: () => void = () => {};
    vi.mocked(cancelOrderV2).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCancel = () => resolve(undefined);
        }),
    );
    renderPage();

    const region = await openRow(/retiro 13:00 hs/i);
    fireEvent.click(within(region).getByRole('button', { name: /^cancelar pedido$/i }));
    fireEvent.click(await screen.findByRole('button', { name: /sí, cancelar pedido/i }));
    await waitFor(() => expect(cancelOrderV2).toHaveBeenCalled());

    // Mientras la primera sigue en curso, se pide cancelar OTRO pedido (la hoja sigue montada).
    fireEvent.click(screen.getByRole('button', { name: /retiro 14:00 hs/i, hidden: true }));
    const otherRegion = screen.getByRole('region', { name: /retiro 14:00 hs/i, hidden: true });
    fireEvent.click(within(otherRegion).getByRole('button', { name: /^cancelar pedido$/i, hidden: true }));

    resolveCancel();

    const notice = await screen.findByRole('status');
    expect(notice).toHaveTextContent('Pedido cancelado');
    expect(notice).toHaveTextContent('2 almuerzos volvieron a tu saldo');
    expect(vi.mocked(cancelOrderV2).mock.calls[0]?.[0]).toBe(202);
  });

  it('shows the error and keeps the order and the row when cancelling fails', async () => {
    vi.mocked(getOrdersV2).mockResolvedValue([friday]);
    vi.mocked(cancelOrderV2).mockRejectedValueOnce(new Error('network error'));
    renderPage();

    const region = await openRow(/retiro 13:00 hs/i);
    fireEvent.click(within(region).getByRole('button', { name: /^cancelar pedido$/i }));
    fireEvent.click(await screen.findByRole('button', { name: /sí, cancelar pedido/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/no pudimos cancelar/i);
    expect(screen.getByTestId('comanda')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

describe('MyOrdersPage — Pago pendiente (F18)', () => {
  it('shows the Mercado Pago comanda without change actions, and its cancel sheet says "Tu saldo no cambia"', async () => {
    vi.mocked(getOrdersV2).mockResolvedValue([todayAwaiting]);
    renderPage();

    const region = await openRow(/retiro 13:00 hs/i);
    expect(within(region).getByText('A pagar con Mercado Pago')).toBeInTheDocument();
    expect(within(region).queryByRole('button', { name: /cambiar horario/i })).not.toBeInTheDocument();

    fireEvent.click(within(region).getByRole('button', { name: /^cancelar pedido$/i }));
    expect(await screen.findByText('Tu saldo no cambia')).toBeInTheDocument();
  });

  it('resumes the payment via "Pagar ahora" and redirects to Mercado Pago', async () => {
    const originalLocationDescriptor = Object.getOwnPropertyDescriptor(window, 'location')!;
    Object.defineProperty(window, 'location', { writable: true, value: { href: '' } });
    try {
      vi.mocked(getOrdersV2).mockResolvedValue([todayAwaiting]);
      vi.mocked(resumeDirectCheckoutV2).mockResolvedValueOnce({
        orderId: 205,
        purchaseId: 'p-1',
        initPoint: 'https://mp.example/checkout/p-1',
      });
      renderPage();

      const region = await openRow(/retiro 13:00 hs/i);
      fireEvent.click(within(region).getByRole('button', { name: /pagar ahora/i }));

      await waitFor(() => expect(resumeDirectCheckoutV2).toHaveBeenCalledWith(205));
      await waitFor(() => expect(window.location.href).toBe('https://mp.example/checkout/p-1'));
    } finally {
      Object.defineProperty(window, 'location', originalLocationDescriptor);
    }
  });

  it('shows "Este pago ya no se puede retomar." and refetches orders on a 409', async () => {
    vi.mocked(getOrdersV2).mockResolvedValue([todayAwaiting]);
    vi.mocked(resumeDirectCheckoutV2).mockRejectedValueOnce(new DirectCheckoutNotResumableError());
    renderPage();

    const region = await openRow(/retiro 13:00 hs/i);
    fireEvent.click(within(region).getByRole('button', { name: /pagar ahora/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Este pago ya no se puede retomar.'));
    await waitFor(() => expect(getOrdersV2).toHaveBeenCalledTimes(2));
  });
});

describe('MyOrdersPage — "Cambiar horario" (F19)', () => {
  const CURRENT = friday.pickupAt;
  const OTHER = new Date('2026-09-25T13:10:00-03:00').toISOString();

  beforeEach(() => {
    vi.mocked(getPickupSlots).mockResolvedValue([new Date(CURRENT).toISOString(), new Date(OTHER).toISOString()]);
  });

  async function pickOtherAndContinue() {
    const region = await openRow(/retiro 13:00 hs/i);
    fireEvent.click(within(region).getByRole('button', { name: /^cambiar horario$/i }));
    const target = new Date(OTHER);
    fireEvent.change(await screen.findByLabelText('Hora de retiro'), { target: { value: String(target.getHours()) } });
    fireEvent.change(screen.getByLabelText('Minutos'), { target: { value: String(target.getMinutes()) } });
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
  }

  it('changes the pickup time in two steps, keeps the row open with an in-row message and refreshes the orders', async () => {
    const changed = { ...friday, pickupAt: OTHER };
    vi.mocked(getOrdersV2).mockResolvedValueOnce([friday]).mockResolvedValue([changed]);
    vi.mocked(changeOrderPickupTimeV2).mockResolvedValueOnce(changed);
    renderPage();

    await pickOtherAndContinue();
    fireEvent.click(await screen.findByRole('button', { name: /sí, cambiar horario/i }));

    await waitFor(() => expect(changeOrderPickupTimeV2).toHaveBeenCalledWith(202, OTHER));
    await waitFor(() => expect(getOrdersV2).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByText('Cambiar horario de retiro')).not.toBeInTheDocument());
    const region = await screen.findByRole('region', { name: new RegExp(`retiro ${formatOrderTimeLabel(OTHER)} hs`, 'i') });
    expect(within(region).getByRole('status')).toHaveTextContent('Horario cambiado');
    expect(within(region).getByRole('status')).toHaveTextContent(`a las ${formatOrderTimeLabel(OTHER)} hs`);
    expect(within(region).getByText(new RegExp(`· ${formatOrderTimeLabel(OTHER)} hs`))).toBeInTheDocument();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('shows the backend message and keeps the sheet open when the change is rejected', async () => {
    vi.mocked(getOrdersV2).mockResolvedValue([friday]);
    vi.mocked(changeOrderPickupTimeV2).mockRejectedValueOnce(
      new PickupTimeChangeError('El horario de retiro ya no se puede cambiar.'),
    );
    renderPage();

    await pickOtherAndContinue();
    fireEvent.click(await screen.findByRole('button', { name: /sí, cambiar horario/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('El horario de retiro ya no se puede cambiar.');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

describe('MyOrdersPage — remove a dish (F29)', () => {
  const single = order(210, '2026-09-25T14:00:00-03:00', { creditTotal: 1, items: [baseOrder.items[0]] });

  it('offers a "×" on each dish of a modifiable order and none on the others', async () => {
    vi.mocked(getOrdersV2).mockResolvedValue([friday, todayConfirmed, todayAwaiting]);
    renderPage();

    const scheduled = await openRow(/retiro 13:00 hs, programado/i);
    expect(within(scheduled).getAllByRole('button', { name: /^quitar .* del pedido$/i })).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: /retiro 12:00 hs/i }));
    const confirmed = await screen.findByRole('region', { name: /retiro 12:00 hs/i });
    expect(within(confirmed).queryByRole('button', { name: /^quitar /i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /retiro 13:00 hs, pago pendiente/i }));
    const awaiting = await screen.findByRole('region', { name: /retiro 13:00 hs, pago pendiente/i });
    expect(within(awaiting).queryByRole('button', { name: /^quitar /i })).not.toBeInTheDocument();
  });

  it('removes a dish through the confirmation sheet, keeps the row open and tells inside it', async () => {
    const after = { ...friday, creditTotal: 1, items: [friday.items[0]] };
    vi.mocked(getOrdersV2).mockResolvedValueOnce([friday]).mockResolvedValue([after]);
    vi.mocked(removeOrderItemV2).mockResolvedValueOnce(after);
    const { queryClient } = renderPage();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    const region = await openRow(/retiro 13:00 hs/i);
    fireEvent.click(within(region).getByRole('button', { name: 'Quitar Ensalada del pedido' }));
    expect(await screen.findByText('¿Quitar Ensalada de tu pedido?')).toBeInTheDocument();
    expect(screen.getByText('Vuelve 1 almuerzo a tu saldo')).toBeInTheDocument();
    expect(screen.queryByText(/es el único plato/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /sí, quitar/i }));

    await waitFor(() => expect(removeOrderItemV2).toHaveBeenCalledWith(202, 2));
    const updated = await screen.findByRole('region', { name: /retiro 13:00 hs/i });
    await waitFor(() => expect(within(updated).getByRole('status')).toHaveTextContent('Plato quitado'));
    expect(within(updated).getByRole('status')).toHaveTextContent('Ensalada ya no está en tu pedido');
    await waitFor(() => expect(within(updated).queryByText('Ensalada')).not.toBeInTheDocument());
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['creditsWallet'] });
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('warns that the only dish cancels the order, and on confirming closes the row and tells at the top', async () => {
    vi.mocked(getOrdersV2)
      .mockResolvedValueOnce([single])
      .mockResolvedValue([{ ...single, estado: 'CANCELADO', items: [], ...closed }]);
    vi.mocked(removeOrderItemV2).mockResolvedValueOnce({ ...single, estado: 'CANCELADO', items: [], ...closed });
    renderPage();

    const region = await openRow(/retiro 14:00 hs/i);
    fireEvent.click(within(region).getByRole('button', { name: 'Quitar Milanesa del pedido' }));
    expect(await screen.findByText('Es el único plato: se cancela el pedido.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /sí, quitar/i }));

    await waitFor(() => expect(removeOrderItemV2).toHaveBeenCalledWith(210, 1));
    const notice = await screen.findByRole('status');
    expect(notice).toHaveTextContent('Pedido cancelado');
    expect(notice).toHaveTextContent('Quitaste el único plato y se canceló el pedido');
    await waitFor(() => expect(screen.queryByTestId('comanda')).not.toBeInTheDocument());
    expect(screen.queryByRole('list', { name: 'Viernes 25' })).not.toBeInTheDocument();
  });

  it('shows the backend message in the sheet when the order can no longer be changed', async () => {
    vi.mocked(getOrdersV2).mockResolvedValue([friday]);
    vi.mocked(removeOrderItemV2).mockRejectedValueOnce(new OrderNotModifiableError());
    renderPage();

    const region = await openRow(/retiro 13:00 hs/i);
    fireEvent.click(within(region).getByRole('button', { name: 'Quitar Milanesa del pedido' }));
    fireEvent.click(await screen.findByRole('button', { name: /sí, quitar/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Tu pedido ya no se puede modificar; armá uno nuevo.');
    expect(screen.getByTestId('comanda')).toBeInTheDocument();
  });
});

describe('MyOrdersPage — deep link ?pedido= (D6, F27.1)', () => {
  const scrollIntoView = vi.fn();

  beforeEach(() => {
    Element.prototype.scrollIntoView = scrollIntoView;
  });

  afterEach(() => {
    scrollIntoView.mockClear();
    delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
  });

  it('opens the linked order once the orders load, and scrolls to it', async () => {
    vi.mocked(getOrdersV2).mockResolvedValue([tuesday, friday]);
    renderAt('/orders/mine?pedido=202');

    const region = await screen.findByRole('region', { name: /retiro 13:00 hs/i });
    expect(within(region).getByText('Comanda Nº 0202')).toBeInTheDocument();
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalled());
  });

  it('switches to the week of the linked order', async () => {
    vi.mocked(getOrdersV2).mockResolvedValue([friday, tuesday]);
    renderAt('/orders/mine?pedido=203');

    const region = await screen.findByRole('region', { name: /retiro 12:30 hs/i });
    expect(within(region).getByText('Comanda Nº 0203')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /semana próxima/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('opens "Anteriores" for a linked past order', async () => {
    vi.mocked(getOrdersV2).mockResolvedValue([friday, pastCancelled]);
    renderAt('/orders/mine?pedido=195');

    const region = await screen.findByRole('region', { name: /retiro 12:00 hs/i });
    expect(within(region).getByText('Comanda Nº 0195')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Anteriores' })).toBeInTheDocument();
  });

  it('closes normally and does not reopen by itself', async () => {
    vi.mocked(getOrdersV2).mockResolvedValue([friday]);
    renderAt('/orders/mine?pedido=202');

    const header = await screen.findByRole('button', { name: /retiro 13:00 hs/i });
    await waitFor(() => expect(header).toHaveAttribute('aria-expanded', 'true'));
    fireEvent.click(header);

    expect(header).toHaveAttribute('aria-expanded', 'false');
  });

  it('waits for the refetch when the cache is stale and still opens the linked order (F27.1)', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } });
    queryClient.setQueryData(['ordersV2'], [tuesday]);
    vi.mocked(getOrdersV2).mockResolvedValue([tuesday, friday]);
    renderAt('/orders/mine?pedido=202', queryClient);

    const region = await screen.findByRole('region', { name: /retiro 13:00 hs/i });
    expect(within(region).getByText('Comanda Nº 0202')).toBeInTheDocument();
  });

  it.each(['999', 'abc', ''])('ignores an unknown pedido (%j) and shows the list closed', async (value) => {
    vi.mocked(getOrdersV2).mockResolvedValue([friday]);
    renderAt(`/orders/mine?pedido=${value}`);

    expect(await screen.findByRole('button', { name: /retiro 13:00 hs/i })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('comanda')).not.toBeInTheDocument();
  });
});
