import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { MyOrdersPage } from './MyOrdersPage';
import { mockMatchMedia } from '@/test/matchMedia';
import { getOrdersV2, getPickupSlots, getRestaurantConfig, type OrderV2 } from '@/features/orders/services/ordersApi';
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
    resumeDirectCheckoutV2: vi.fn(),
  };
});

vi.mock('@/features/credits/services/creditsApi', () => ({
  getWallet: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const HOUR_MS = 60 * 60 * 1000;
const NOW = new Date('2026-09-26T10:00:00-03:00');
const CURRENT = new Date(NOW.getTime() + 3 * HOUR_MS).toISOString();
const OTHER = new Date(NOW.getTime() + 3 * HOUR_MS + 30 * 60 * 1000).toISOString();

const scheduled: OrderV2 = {
  id: 300,
  fecha: '2026-09-26',
  pickupAt: CURRENT,
  estado: 'PENDIENTE',
  creditTotal: 4,
  notas: null,
  items: [
    { id: 1, dishId: 10, dishNombre: 'Milanesa', dishCategoria: 'Premium', sideId: 5, sideNombre: 'Puré', creditCost: 2, notas: null },
    { id: 2, dishId: 11, dishNombre: 'Ensalada', dishCategoria: 'Básico', sideId: null, sideNombre: null, creditCost: 2, notas: null },
  ],
  cancellable: true,
  modifiable: true,
  pickupTimeChangeable: true,
  paidWithMercadoPago: false,
};
const second: OrderV2 = { ...scheduled, id: 301, pickupAt: new Date(NOW.getTime() + 5 * HOUR_MS).toISOString() };
const past: OrderV2 = {
  ...scheduled,
  id: 190,
  fecha: '2026-09-24',
  pickupAt: new Date(NOW.getTime() - 48 * HOUR_MS).toISOString(),
  estado: 'ENTREGADO',
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
  vi.mocked(getRestaurantConfig).mockResolvedValue({
    horaCorte: '10:00',
    pickupWindowStart: null,
    pickupWindowEnd: null,
    pickupLeadMinutes: 20,
  });
  vi.mocked(getPickupSlots).mockResolvedValue([CURRENT, OTHER]);
}

describe('MyOrdersPage on desktop (F22b)', () => {
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

  it('lays the tickets in a two-column grid next to the balance side panel', async () => {
    vi.mocked(getOrdersV2).mockResolvedValue([scheduled, second]);
    renderPage();

    const cards = await screen.findAllByTestId('order-card');
    expect(cards[0].parentElement).toHaveAttribute('data-layout', 'grid');

    const panel = screen.getByRole('complementary', { name: 'Resumen' });
    expect(await within(panel).findByText('8')).toBeInTheDocument();
    expect(within(panel).getByText('almuerzos para pedir')).toBeInTheDocument();
    expect(within(panel).getByText('4 almuerzos')).toBeInTheDocument();
    expect(within(panel).getByText(/reservados en pedidos programados/)).toBeInTheDocument();
    expect(within(panel).getByRole('link', { name: 'Hacer un pedido' })).toHaveAttribute('href', '/orders/today');
    expect(within(panel).getByRole('link', { name: 'Ver mis almuerzos' })).toHaveAttribute('href', '/credits');
    expect(await within(panel).findByText(/hasta 20 minutos antes del retiro/)).toBeInTheDocument();
  });

  it('keeps the default view and reveals Anteriores with "Ver pedidos anteriores"', async () => {
    vi.mocked(getOrdersV2).mockResolvedValue([scheduled, past]);
    renderPage();

    expect(await screen.findAllByTestId('order-card')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: /ver pedidos anteriores/i }));

    expect(screen.getByRole('heading', { name: 'Anteriores' })).toBeInTheDocument();
    expect(screen.getAllByTestId('order-card')).toHaveLength(2);
  });

  it('opens the comanda as a centered modal, and Escape closes it', async () => {
    vi.mocked(getOrdersV2).mockResolvedValue([scheduled]);
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /ver la comanda del pedido/i }));

    const dialog = await screen.findByRole('dialog', { name: /pedido programado/i });
    expect(dialog).toHaveAttribute('data-presentation', 'modal');
    expect(within(dialog).getByRole('button', { name: 'Cerrar la comanda' })).toBeInTheDocument();

    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('opens "Cambiar horario" and "Cancelar pedido" as centered dialogs', async () => {
    vi.mocked(getOrdersV2).mockResolvedValue([scheduled]);
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /cambiar el horario de retiro del pedido/i }));
    const change = await screen.findByRole('dialog', { name: 'Cambiar horario de retiro' });
    expect(change).toHaveAttribute('data-presentation', 'dialog');
    fireEvent.click(within(change).getByRole('button', { name: 'Volver sin cambiar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /cancelar pedido/i }));
    const cancel = await screen.findByRole('dialog', { name: '¿Cancelar este pedido?' });
    expect(cancel).toHaveAttribute('data-presentation', 'dialog');
  });
});

describe('MyOrdersPage on mobile (F22b)', () => {
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

  it('has no side panel and a single-column list', async () => {
    vi.mocked(getOrdersV2).mockResolvedValue([scheduled, second]);
    renderPage();

    const cards = await screen.findAllByTestId('order-card');
    expect(cards[0].parentElement).not.toHaveAttribute('data-layout');
    expect(screen.queryByRole('complementary', { name: 'Resumen' })).not.toBeInTheDocument();
  });

  it('opens the cancel sheet bottom-anchored and the comanda full screen', async () => {
    vi.mocked(getOrdersV2).mockResolvedValue([scheduled]);
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /cancelar pedido/i }));
    expect(await screen.findByRole('dialog', { name: '¿Cancelar este pedido?' })).toHaveAttribute('data-presentation', 'sheet');
  });
});
