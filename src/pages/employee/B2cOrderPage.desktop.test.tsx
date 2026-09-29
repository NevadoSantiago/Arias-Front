import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { B2cOrderPage } from './B2cOrderPage';
import { mockMatchMedia } from '@/test/matchMedia';
import { useAuthStore, type AuthUser } from '@/features/auth/store/authStore';
import { useCartStore } from '@/features/orders/store/cartStore';
import {
  getAvailableDishes,
  getDisabledDates,
  getDishPreference,
  getMenuSections,
  getOrdersV2,
  getPickupSlots,
  getRestaurantConfig,
  BalanceCoversOrderError,
  InsufficientCreditsError,
  placeOrderV2,
  startDirectCheckoutV2,
  type OrderV2,
} from '@/features/orders/services/ordersApi';
import { getPacks, getWallet } from '@/features/credits/services/creditsApi';
import type { Dish } from '@/features/orders/types';

vi.mock('@/features/orders/services/ordersApi', async () => {
  const actual = await vi.importActual<typeof import('@/features/orders/services/ordersApi')>(
    '@/features/orders/services/ordersApi',
  );
  return {
    ...actual,
    addOrderItemsV2: vi.fn(),
    cancelOrderV2: vi.fn(),
    getAvailableDishes: vi.fn(),
    getDisabledDates: vi.fn(),
    getDishPreference: vi.fn(),
    getMenuSections: vi.fn(),
    getOrdersV2: vi.fn(),
    getPickupSlots: vi.fn(),
    getRestaurantConfig: vi.fn(),
    placeOrderV2: vi.fn(),
    removeOrderItemV2: vi.fn(),
    startDirectCheckoutV2: vi.fn(),
  };
});

vi.mock('@/features/credits/services/creditsApi', () => ({
  getWallet: vi.fn(),
  getPacks: vi.fn(),
}));


const baseUser: AuthUser = {
  id: 7,
  email: 'cliente@example.com',
  firstName: 'Lucía',
  lastName: null,
  nickname: null,
  displayName: 'Sofi',
  role: 'EMPLOYEE',
  companyId: null,
  companyName: null,
  categoryId: null,
  emailVerified: true,
  profileComplete: true,
};

const dish: Dish = {
  id: 10,
  nombre: 'Milanesa napolitana',
  descripcion: 'Con papas fritas',
  fotoUrl: null,
  category: { id: 1, nombre: 'Básico', parentId: null, creditCost: 2 },
  menuSection: { id: 1, nombre: 'Carnes', ordenDisplay: 1 },
  sideType: null,
  allowedSides: [],
  stockActual: 5,
  especial: false,
};

const placed: OrderV2 = {
  id: 99,
  fecha: '2026-05-21',
  pickupAt: '2026-05-21T15:00:00Z',
  estado: 'PENDIENTE',
  creditTotal: 2,
  notas: null,
  items: [
    { id: 1, dishId: 10, dishNombre: 'Milanesa napolitana', dishCategoria: 'Básico', sideId: null, sideNombre: null, creditCost: 2, notas: null },
  ],
  cancellable: true,
  modifiable: true,
  pickupTimeChangeable: true,
  paidWithMercadoPago: false,
  creditsFromBalance: 0,
};

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <B2cOrderPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function addDishToCart() {
  fireEvent.click(await screen.findByRole('button', { name: /milanesa napolitana/i }));
  fireEvent.click(await screen.findByRole('button', { name: /agregar al pedido/i }));
}

function mockBackend() {
  useAuthStore.setState({ accessToken: 'token', user: baseUser, bootstrapping: false });
  vi.mocked(getMenuSections).mockResolvedValue([{ id: 1, nombre: 'Carnes', ordenDisplay: 1 }]);
  vi.mocked(getDisabledDates).mockResolvedValue([]);
  vi.mocked(getAvailableDishes).mockResolvedValue([dish]);
  vi.mocked(getPickupSlots).mockResolvedValue(['2026-05-21T15:00:00Z']);
  vi.mocked(getDishPreference).mockResolvedValue(null);
  vi.mocked(getOrdersV2).mockResolvedValue([]);
  vi.mocked(getRestaurantConfig).mockResolvedValue({
    horaCorte: '10:00',
    pickupWindowStart: '11:00',
    pickupWindowEnd: '23:00',
  });
  vi.mocked(getWallet).mockResolvedValue({ available: 12, committed: 0, expiresAt: null });
  vi.mocked(getPacks).mockResolvedValue([]);
}

// El carrito es un store global (F24): cada test arranca vacío.
afterEach(() => useCartStore.getState().reset());

describe('B2cOrderPage — desktop layout (F22a)', () => {
  let media: ReturnType<typeof mockMatchMedia>;

  beforeEach(() => {
    media = mockMatchMedia(true);
    mockBackend();
  });

  afterEach(() => {
    media.restore();
    useAuthStore.setState({ accessToken: null, user: null, bootstrapping: true });
    vi.clearAllMocks();
  });

  it('shows the sticky "Tu pedido" panel instead of the bottom cart bar', async () => {
    renderPage();

    const panel = await screen.findByRole('complementary', { name: 'Tu pedido' });
    expect(within(panel).getByText(/elegí un plato del menú/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /ver pedido/i })).not.toBeInTheDocument();
  });

  it('opens the dish detail as a centered dialog, not a sheet', async () => {
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /milanesa napolitana/i }));

    const detail = await screen.findByRole('dialog', { name: 'Milanesa napolitana' });
    expect(detail).toHaveAttribute('data-presentation', 'dialog');
  });

  it('fills the panel with the cart line, the pickup picker and the balance box, and confirms from it', async () => {
    vi.mocked(placeOrderV2).mockResolvedValueOnce(placed);
    renderPage();

    await addDishToCart();

    const panel = await screen.findByRole('complementary', { name: 'Tu pedido' });
    expect(within(panel).getByText('Milanesa napolitana')).toBeInTheDocument();
    expect(await within(panel).findByText('Te quedan')).toBeInTheDocument();
    expect(within(panel).getByText('10 almuerzos')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(await within(panel).findByRole('button', { name: /^retiro /i }));

    await waitFor(() =>
      expect(placeOrderV2).toHaveBeenCalledWith({
        items: [{ dishId: 10, sideId: null, notas: null }],
        pickupAt: '2026-05-21T15:00:00Z',
        notas: null,
      }),
    );
    expect(await screen.findByText('¡Pedido confirmado!')).toBeInTheDocument();
  });

  it('removes a line from the panel', async () => {
    renderPage();
    await addDishToCart();
    const panel = await screen.findByRole('complementary', { name: 'Tu pedido' });

    fireEvent.click(within(panel).getByRole('button', { name: /quitar milanesa napolitana/i }));

    expect(await within(panel).findByText(/elegí un plato del menú/i)).toBeInTheDocument();
  });

  it('says "Te faltan N" when the order needs more than the balance (the server still decides)', async () => {
    vi.mocked(getWallet).mockResolvedValue({ available: 1, committed: 0, expiresAt: null });
    renderPage();

    await addDishToCart();

    const panel = await screen.findByRole('complementary', { name: 'Tu pedido' });
    expect(await within(panel).findByText('Te falta 1 almuerzo')).toBeInTheDocument();
    expect(within(panel).queryByText('Te quedan')).not.toBeInTheDocument();
  });

  it('opens the direct payment as a centered dialog when the server rejects for balance', async () => {
    vi.mocked(getWallet).mockResolvedValue({ available: 0, committed: 0, expiresAt: null });
    vi.mocked(placeOrderV2).mockRejectedValueOnce(new InsufficientCreditsError());
    renderPage();

    await addDishToCart();
    const panel = await screen.findByRole('complementary', { name: 'Tu pedido' });
    fireEvent.click(await within(panel).findByRole('button', { name: /^retiro /i }));

    const pay = await screen.findByRole('dialog', { name: /pagá este pedido con mercado pago/i });
    expect(pay).toHaveAttribute('data-presentation', 'dialog');
  });

  it('shows the balance-covers-order message in the "Tu pedido" panel without opening the mobile review sheet (409)', async () => {
    vi.mocked(getWallet).mockResolvedValue({ available: 1, committed: 0, expiresAt: null });
    vi.mocked(placeOrderV2).mockRejectedValueOnce(new InsufficientCreditsError());
    vi.mocked(getPacks).mockResolvedValue([
      { id: 1, code: 'DAY', nombre: 'Sueltos', creditAmount: 1, priceCents: 150000, discountPercent: 0, ordenDisplay: 1, enabled: true },
    ]);
    vi.mocked(startDirectCheckoutV2).mockRejectedValueOnce(new BalanceCoversOrderError());
    renderPage();

    await addDishToCart();
    const panel = await screen.findByRole('complementary', { name: 'Tu pedido' });
    fireEvent.click(await within(panel).findByRole('button', { name: /^retiro /i }));
    fireEvent.click(await screen.findByRole('button', { name: /pagar \$\s?1\.500,00 con mercado pago/i }));

    expect(await within(panel).findByText(/tus almuerzos disponibles ahora alcanzan para este pedido/i)).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(placeOrderV2).toHaveBeenCalledTimes(1);
  });
});

describe('B2cOrderPage — mobile layout is unchanged (F22a)', () => {
  beforeEach(mockBackend);

  afterEach(() => {
    useAuthStore.setState({ accessToken: null, user: null, bootstrapping: true });
    vi.clearAllMocks();
  });

  it('keeps the bottom cart bar and the sheet, with no side panel', async () => {
    renderPage();

    expect(screen.queryByRole('complementary', { name: 'Tu pedido' })).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: /milanesa napolitana/i }));
    const detail = await screen.findByRole('dialog', { name: 'Milanesa napolitana' });
    expect(detail).toHaveAttribute('data-presentation', 'sheet');

    fireEvent.click(await screen.findByRole('button', { name: /agregar al pedido/i }));
    expect(await screen.findByRole('button', { name: /ver pedido/i })).toBeInTheDocument();
  });
});
