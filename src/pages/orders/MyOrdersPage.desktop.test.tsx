import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { MyOrdersPage } from './MyOrdersPage';
import { mockMatchMedia } from '@/test/matchMedia';
import {
  getDisabledDates,
  getOrdersV2,
  getPickupSlots,
  getRestaurantConfig,
  type OrderV2,
} from '@/features/orders/services/ordersApi';
import { getWallet } from '@/features/credits/services/creditsApi';
import { useAuthStore } from '@/features/auth/store/authStore';

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

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

/** Jueves 24 de septiembre de 2026, 11:40 en Buenos Aires — el "ahora" del tablero de diseño. */
const NOW = new Date('2026-09-24T11:40:00-03:00');

const scheduled: OrderV2 = {
  id: 202,
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
const today: OrderV2 = { ...scheduled, id: 201, fecha: '2026-09-24', pickupAt: '2026-09-24T12:00:00-03:00' };
const todayLater: OrderV2 = { ...today, id: 203, pickupAt: '2026-09-24T15:00:00-03:00' };
const nextMonday: OrderV2 = { ...scheduled, id: 206, fecha: '2026-09-28', pickupAt: '2026-09-28T12:30:00-03:00' };
const past: OrderV2 = {
  ...scheduled,
  id: 190,
  fecha: '2026-09-22',
  pickupAt: '2026-09-22T13:10:00-03:00',
  estado: 'CONFIRMADO',
  cancellable: false,
  modifiable: false,
  pickupTimeChangeable: false,
};

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <MyOrdersPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function arrangeCommon() {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  vi.mocked(getWallet).mockResolvedValue({ available: 8, committed: 4, expiresAt: null });
  vi.mocked(getDisabledDates).mockResolvedValue([]);
  vi.mocked(getRestaurantConfig).mockResolvedValue({
    horaCorte: '10:00',
    pickupWindowStart: null,
    pickupWindowEnd: null,
    pickupLeadMinutes: 20,
    pickupSchedule: [1, 2, 3, 4, 5, 6, 7].map((dayOfWeek) => ({
      dayOfWeek,
      open: dayOfWeek <= 5,
      windowStart: dayOfWeek <= 5 ? '11:00' : null,
      windowEnd: dayOfWeek <= 5 ? '23:00' : null,
    })),
  });
  vi.mocked(getPickupSlots).mockResolvedValue([scheduled.pickupAt]);
}

describe('MyOrdersPage on desktop (F22b, F29)', () => {
  let media: ReturnType<typeof mockMatchMedia>;

  beforeEach(() => {
    arrangeCommon();
    media = mockMatchMedia(true);
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
    media.restore();
    vi.clearAllMocks();
    vi.useRealTimers();
    useAuthStore.setState({ accessToken: null, user: null, bootstrapping: true });
  });

  it('stacks both weeks, each with its dates and order count', async () => {
    vi.mocked(getOrdersV2).mockResolvedValue([today, todayLater, scheduled, nextMonday]);
    renderPage();

    const esta = (await screen.findByRole('heading', { name: 'Esta semana' })).closest('section') as HTMLElement;
    const proxima = screen.getByRole('heading', { name: 'Semana próxima' }).closest('section') as HTMLElement;
    expect(within(esta).getByText('21–25 sep')).toBeInTheDocument();
    expect(within(esta.querySelector('header') as HTMLElement).getByText('3 pedidos')).toBeInTheDocument();
    expect(within(proxima).getByText('28 sep – 2 oct')).toBeInTheDocument();
    expect(within(proxima.querySelector('header') as HTMLElement).getByText('1 pedido')).toBeInTheDocument();
    // Sin interruptor: las dos semanas están a la vista.
    expect(screen.queryByRole('button', { name: /^esta semana/i })).not.toBeInTheDocument();
  });

  it('makes each day a row: the day on the left, its orders in one vertical list on the right', async () => {
    vi.mocked(getOrdersV2).mockResolvedValue([today, todayLater, scheduled]);
    renderPage();

    const esta = (await screen.findByRole('heading', { name: 'Esta semana' })).closest('section') as HTMLElement;
    const [thursday, friday] = within(esta).getAllByTestId('day-row');
    expect(within(thursday).getByText('Jueves')).toBeInTheDocument();
    expect(within(thursday).getByText('24')).toBeInTheDocument();
    expect(within(thursday).getByText('Hoy')).toBeInTheDocument();
    expect(thursday).toHaveAttribute('data-today', 'true');
    const list = within(thursday).getByRole('list', { name: 'Jueves 24' });
    expect(within(list).getAllByRole('button', { name: /retiro/i })).toHaveLength(2);
    expect(within(friday).getByRole('list', { name: 'Viernes 25' })).toBeInTheDocument();
    expect(friday).toHaveAttribute('data-today', 'false');
  });

  it('shows empty days compact, the past days in one line and an empty week with its empty state', async () => {
    vi.mocked(getOrdersV2).mockResolvedValue([scheduled]);
    renderPage();

    const esta = (await screen.findByRole('heading', { name: 'Esta semana' })).closest('section') as HTMLElement;
    expect(within(esta).getByText('Lunes 21 a miércoles 23')).toBeInTheDocument();
    expect(within(within(esta).getAllByTestId('day-row')[0]).getByText('Sin pedidos')).toBeInTheDocument();
    const proxima = screen.getByRole('heading', { name: 'Semana próxima' }).closest('section') as HTMLElement;
    expect(within(proxima).getByText('No tenés pedidos para la semana próxima')).toBeInTheDocument();
    expect(within(proxima).getByRole('link', { name: 'Hacer un pedido' })).toHaveAttribute('href', '/orders/today');
  });

  it('ends the side panel with a decorative illustration, below the cancellation note', async () => {
    vi.mocked(getOrdersV2).mockResolvedValue([scheduled, nextMonday]);
    renderPage();

    const panel = await screen.findByRole('complementary', { name: 'Resumen' });
    const art = panel.lastElementChild as HTMLElement;
    expect(art.tagName).toBe('IMG');
    expect(art).toHaveAttribute('alt', '');
    expect(art).toHaveAttribute('aria-hidden', 'true');
    expect(art.getAttribute('src')).toMatch(/PedidoConfirmado-transparente.*.svg/);
    expect(art.previousElementSibling).toHaveTextContent(/podés cancelar un pedido/i);
  });

  it('keeps the balance side panel next to the weeks', async () => {
    vi.mocked(getOrdersV2).mockResolvedValue([scheduled, nextMonday]);
    renderPage();

    const panel = await screen.findByRole('complementary', { name: 'Resumen' });
    expect(await within(panel).findByText('8')).toBeInTheDocument();
    expect(within(panel).getByText('almuerzos para pedir')).toBeInTheDocument();
    expect(within(panel).getByText('4 almuerzos')).toBeInTheDocument();
    expect(within(panel).getByText(/reservados en pedidos programados/)).toBeInTheDocument();
    expect(within(panel).getByRole('link', { name: 'Hacer un pedido' })).toHaveAttribute('href', '/orders/today');
    expect(within(panel).getByRole('link', { name: 'Ver mis almuerzos' })).toHaveAttribute('href', '/credits');
    expect(await within(panel).findByText(/hasta 20 minutos antes del retiro/)).toBeInTheDocument();
  });

  it('keeps the default view and reveals Anteriores as one vertical list with "Ver pedidos anteriores"', async () => {
    vi.mocked(getOrdersV2).mockResolvedValue([scheduled, past]);
    renderPage();

    expect(await screen.findAllByTestId('order-accordion-item')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: /ver pedidos anteriores/i }));

    expect(screen.getByRole('heading', { name: 'Anteriores' })).toBeInTheDocument();
    expect(screen.getAllByTestId('order-accordion-item')).toHaveLength(2);
    expect(within(screen.getByRole('list', { name: 'Anteriores' })).getByText('Martes 22')).toBeInTheDocument();
  });

  it('opens the comanda in the row: the ticket with the message and actions below it (no side column); one at a time', async () => {
    vi.mocked(getOrdersV2).mockResolvedValue([today, scheduled]);
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /retiro 13:00 hs/i, expanded: false }));
    const region = await screen.findByRole('region', { name: /retiro 13:00 hs/i });
    expect(region.querySelector('[data-layout="split"]')).toBeNull();
    expect(region.querySelector('[data-testid="order-actions-area"]')).not.toBeNull();
    expect(within(region).getByRole('button', { name: /^cambiar horario$/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /retiro 12:00 hs/i }));
    expect(screen.getAllByTestId('comanda')).toHaveLength(1);
    expect(screen.getByRole('button', { name: /retiro 13:00 hs/i })).toHaveAttribute('aria-expanded', 'false');
  });

  it('opens "Cambiar horario" and "Cancelar pedido" as centered dialogs', async () => {
    vi.mocked(getOrdersV2).mockResolvedValue([scheduled]);
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /retiro 13:00 hs/i }));
    const region = await screen.findByRole('region', { name: /retiro 13:00 hs/i });

    fireEvent.click(within(region).getByRole('button', { name: /^cambiar horario$/i }));
    const change = await screen.findByRole('dialog', { name: 'Cambiar horario de retiro' });
    expect(change).toHaveAttribute('data-presentation', 'dialog');
    fireEvent.click(within(change).getByRole('button', { name: 'Volver sin cambiar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    fireEvent.click(within(region).getByRole('button', { name: /^cancelar pedido$/i }));
    const cancel = await screen.findByRole('dialog', { name: '¿Cancelar este pedido?' });
    expect(cancel).toHaveAttribute('data-presentation', 'dialog');
  });

  it('opens "Quitar plato" as a centered dialog from the "×" of a dish', async () => {
    vi.mocked(getOrdersV2).mockResolvedValue([scheduled]);
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /retiro 13:00 hs/i }));
    const region = await screen.findByRole('region', { name: /retiro 13:00 hs/i });
    fireEvent.click(within(region).getByRole('button', { name: 'Quitar Milanesa del pedido' }));

    const remove = await screen.findByRole('dialog', { name: '¿Quitar Milanesa de tu pedido?' });
    expect(remove).toHaveAttribute('data-presentation', 'dialog');
  });
});

describe('MyOrdersPage on mobile (F22b, F29)', () => {
  let media: ReturnType<typeof mockMatchMedia>;

  beforeEach(() => {
    arrangeCommon();
    media = mockMatchMedia(false);
  });

  afterEach(() => {
    media.restore();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('has no side panel, one week at a time behind the switch, and no desktop day rows', async () => {
    vi.mocked(getOrdersV2).mockResolvedValue([scheduled, nextMonday]);
    renderPage();

    expect(await screen.findByRole('button', { name: /esta semana/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('complementary', { name: 'Resumen' })).not.toBeInTheDocument();
    expect(document.querySelector('img[src*="PedidoConfirmado-transparente"]')).toBeNull();
    expect(screen.queryByTestId('day-row')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Semana próxima' })).not.toBeInTheDocument();
  });

  it('opens the cancel sheet bottom-anchored', async () => {
    vi.mocked(getOrdersV2).mockResolvedValue([scheduled]);
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /retiro 13:00 hs/i }));
    const region = await screen.findByRole('region', { name: /retiro 13:00 hs/i });
    expect(region.querySelector('[data-layout="stack"]')).not.toBeNull();
    fireEvent.click(within(region).getByRole('button', { name: /^cancelar pedido$/i }));

    expect(await screen.findByRole('dialog', { name: '¿Cancelar este pedido?' })).toHaveAttribute('data-presentation', 'sheet');
  });
});
