import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
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
  type OrderV2,
} from '@/features/orders/services/ordersApi';
import { getPacks, getWallet } from '@/features/credits/services/creditsApi';
import { getReviewPrompt } from '@/features/me/services/meApi';
import type { Dish } from '@/features/orders/types';

vi.mock('@/features/me/services/meApi', () => ({
  getReviewPrompt: vi.fn(),
  markReviewOpened: vi.fn(),
  markReviewNever: vi.fn(),
}));
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

// A known Monday: `WeekDaySelector` only renders Mon–Fri.
const NOW = '2026-06-01T09:00:00';
const TODAY_ISO = '2026-06-01';
const TOMORROW_ISO = '2026-06-02';
const THURSDAY_ISO = '2026-06-04';

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

function orderOn(fecha: string, overrides: Partial<OrderV2> = {}): OrderV2 {
  return {
    id: 99,
    fecha,
    pickupAt: `${fecha}T15:00:00Z`,
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
    ...overrides,
  };
}

function renderPage(route = '/') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <B2cOrderPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// The day's order card also lists the dish: the menu card is the one with its description.
const DISH_CARD = /milanesa napolitana.*con papas fritas/i;

async function selectDish() {
  fireEvent.click(await screen.findByRole('button', { name: DISH_CARD }));
  fireEvent.click(await screen.findByRole('button', { name: /agregar al pedido/i }));
}

function setup({
  orders = [] as OrderV2[],
  balance = 12,
  discount = null as { percent: number; expiresAt: string } | null,
  review = { show: false, dishName: null, reviewUrl: null } as { show: boolean; dishName: string | null; reviewUrl: string | null },
} = {}) {
  vi.mocked(getReviewPrompt).mockResolvedValue(review);
  vi.setSystemTime(new Date(NOW));
  useAuthStore.setState({ accessToken: 'token', user: baseUser, bootstrapping: false });
  vi.mocked(getMenuSections).mockResolvedValue([{ id: 1, nombre: 'Carnes', ordenDisplay: 1 }]);
  vi.mocked(getDisabledDates).mockResolvedValue([]);
  vi.mocked(getAvailableDishes).mockResolvedValue([dish]);
  vi.mocked(getPickupSlots).mockResolvedValue([`${TODAY_ISO}T15:00:00Z`]);
  vi.mocked(getDishPreference).mockResolvedValue(null);
  vi.mocked(getOrdersV2).mockResolvedValue(orders);
  vi.mocked(getRestaurantConfig).mockResolvedValue({
    horaCorte: '10:00',
    pickupWindowStart: '11:00',
    pickupWindowEnd: '23:00',
  });
  vi.mocked(getWallet).mockResolvedValue({ available: balance, committed: 0, expiresAt: null, discount });
  vi.mocked(getPacks).mockResolvedValue([]);
}

afterEach(() => {
  useCartStore.getState().reset();
  useAuthStore.setState({ accessToken: null, user: null, bootstrapping: true });
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe('B2cOrderPage — empty-balance banner', () => {
  const banner = /tu próximo almuerzo te está esperando/i;

  it('is shown on a day without an order when the balance is 0', async () => {
    mockMatchMedia(false);
    setup({ balance: 0 });
    renderPage();

    expect(await screen.findByText(banner)).toBeInTheDocument();
  });

  it('renders below the week calendar so the calendar never moves', async () => {
    mockMatchMedia(false);
    setup({ balance: 0 });
    renderPage();

    const bannerEl = await screen.findByText(banner);
    const calendarChip = screen.getByRole('link', { name: /Ver mis pedidos/ });
    expect(calendarChip.compareDocumentPosition(bannerEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('is hidden when the selected day already has an order', async () => {
    mockMatchMedia(false);
    setup({ balance: 0, orders: [orderOn(TODAY_ISO)] });
    renderPage();

    await screen.findByRole('button', { name: DISH_CARD });
    expect(screen.queryByText(banner)).not.toBeInTheDocument();
  });

  it('still shows when the only order of the day is cancelled', async () => {
    mockMatchMedia(false);
    setup({ balance: 0, orders: [orderOn(TODAY_ISO, { estado: 'CANCELADO' })] });
    renderPage();

    expect(await screen.findByText(banner)).toBeInTheDocument();
  });

  it('is hidden on desktop too when the day has an order', async () => {
    mockMatchMedia(true);
    setup({ balance: 0, orders: [orderOn(TODAY_ISO)] });
    renderPage();

    await screen.findByRole('button', { name: DISH_CARD });
    expect(screen.queryByText(banner)).not.toBeInTheDocument();
  });
});

describe('B2cOrderPage — surprise and review prompt', () => {
  const discount = { percent: 10, expiresAt: '2099-01-01T00:00:00Z' };

  beforeEach(() => window.localStorage.clear());

  it('shows the closed surprise (hero, above the calendar) while the wallet has a discount', async () => {
    mockMatchMedia(false);
    setup({ balance: 12, discount });
    renderPage();

    const gift = await screen.findByRole('button', { name: /tu almuerzo vino con sorpresa/i });
    const calendarChip = screen.getByRole('link', { name: /Ver mis pedidos/ });
    expect(gift.compareDocumentPosition(calendarChip) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByText(/off en tu próxima compra/i)).not.toBeInTheDocument();
  });

  it('replaces the empty-balance card with the surprise when the balance is 0', async () => {
    mockMatchMedia(false);
    setup({ balance: 0, discount });
    renderPage();

    expect(await screen.findByRole('button', { name: /tu almuerzo vino con sorpresa/i })).toBeInTheDocument();
    expect(screen.queryByText(/tu próximo almuerzo te está esperando/i)).not.toBeInTheDocument();
  });

  it('opens the surprise on tap and links to the buy flow', async () => {
    mockMatchMedia(false);
    setup({ balance: 12, discount });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /tu almuerzo vino con sorpresa/i }));

    expect(screen.getByText('de descuento en tu próxima compra')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /comprar almuerzos/i })).toHaveAttribute('href', '/credits?comprar=1');
  });

  it('shows no surprise when there is no discount', async () => {
    mockMatchMedia(false);
    setup({ balance: 12 });
    renderPage();

    await screen.findByRole('button', { name: DISH_CARD });
    expect(screen.queryByText(/sorpresa/i)).not.toBeInTheDocument();
  });

  it('shows the review card below the calendar only when the server says so', async () => {
    mockMatchMedia(false);
    setup({ balance: 12, review: { show: true, dishName: 'Flan', reviewUrl: 'https://g.page/r/x' } });
    renderPage();

    const card = await screen.findByText('¿Qué tal estuvo tu Flan?');
    const calendarChip = screen.getByRole('link', { name: /Ver mis pedidos/ });
    expect(calendarChip.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows no review card when show is false', async () => {
    mockMatchMedia(false);
    setup({ balance: 12 });
    renderPage();

    await screen.findByRole('button', { name: DISH_CARD });
    expect(screen.queryByText(/qué tal estuvo/i)).not.toBeInTheDocument();
  });
});

describe('B2cOrderPage — desktop, day with an order', () => {
  let media: ReturnType<typeof mockMatchMedia>;

  beforeEach(() => {
    media = mockMatchMedia(true);
  });
  afterEach(() => media.restore());

  it('replaces the "Tu pedido" panel with the large illustration and a link to Mis pedidos', async () => {
    setup({ orders: [orderOn(TODAY_ISO)] });
    renderPage();

    const art = await screen.findByTestId('daily-illustration');
    expect(screen.queryByRole('complementary', { name: 'Tu pedido' })).not.toBeInTheDocument();
    expect(art).toHaveClass('h-[360px]');
    expect(screen.getByText(/ya tenés tu pedido de hoy/i)).toBeInTheDocument();
    const line = screen.getByText(/ya tenés tu pedido de hoy/i).closest('p')!;
    expect(within(line).getByRole('link', { name: /ver en mis pedidos/i })).toHaveAttribute('href', '/orders/mine');
  });

  it('brings the panel back with the regular illustration once a dish is selected', async () => {
    setup({ orders: [orderOn(TODAY_ISO)] });
    renderPage();

    await selectDish();

    const panel = await screen.findByRole('complementary', { name: 'Tu pedido' });
    expect(within(panel).getByText(/milanesa napolitana/i)).toBeInTheDocument();
    expect(screen.getByTestId('daily-illustration')).toHaveClass('h-[280px]');
    expect(screen.queryByText(/ya tenés tu pedido/i)).not.toBeInTheDocument();
  });

  it('keeps the regular panel on a day without an order', async () => {
    setup({ orders: [orderOn(TOMORROW_ISO)] });
    renderPage();

    expect(await screen.findByRole('complementary', { name: 'Tu pedido' })).toBeInTheDocument();
    expect(screen.getByTestId('daily-illustration')).toHaveClass('h-[280px]');
    expect(screen.queryByText(/ya tenés tu pedido/i)).not.toBeInTheDocument();
  });

  it('does not count a cancelled order', async () => {
    setup({ orders: [orderOn(TODAY_ISO, { estado: 'CANCELADO' })] });
    renderPage();

    expect(await screen.findByRole('complementary', { name: 'Tu pedido' })).toBeInTheDocument();
    expect(screen.queryByText(/ya tenés tu pedido/i)).not.toBeInTheDocument();
  });

  it('says "de mañana" for tomorrow', async () => {
    setup({ orders: [orderOn(TOMORROW_ISO)] });
    renderPage(`/?fecha=${TOMORROW_ISO}`);

    expect(await screen.findByText(/ya tenés tu pedido de mañana/i)).toBeInTheDocument();
  });

  it('says "del jueves" for a later day', async () => {
    setup({ orders: [orderOn(THURSDAY_ISO)] });
    renderPage(`/?fecha=${THURSDAY_ISO}`);

    expect(await screen.findByText(/ya tenés tu pedido del jueves/i)).toBeInTheDocument();
  });
});

describe('B2cOrderPage — mobile, day with an order', () => {
  beforeEach(() => {
    mockMatchMedia(false);
  });

  it('hides the empty cart bar and shows no illustration until a dish is selected', async () => {
    setup({ orders: [orderOn(TODAY_ISO)] });
    renderPage();

    await screen.findByRole('button', { name: DISH_CARD });
    expect(screen.queryByText(/tocá un plato para armar tu pedido/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId('daily-illustration')).not.toBeInTheDocument();

    await selectDish();
    // En celular el primer plato abre solo la hoja "Tu pedido" (la barra queda detrás).
    expect(await screen.findByRole('dialog', { name: /tu pedido/i })).toBeInTheDocument();
  });

  it('keeps the empty cart bar on a day without an order', async () => {
    setup({ orders: [] });
    renderPage();

    expect(await screen.findByText(/tocá un plato para armar tu pedido/i)).toBeInTheDocument();
  });
});

describe('B2cOrderPage — stable calendar position', () => {
  it('reserves two lines for the day title so switching days does not move the calendar', async () => {
    mockMatchMedia(false);
    setup({ balance: 1 });
    renderPage();

    const title = await screen.findByRole('heading', { level: 1 });
    expect(title.className).toContain('min-h-[2lh]');
  });
});
