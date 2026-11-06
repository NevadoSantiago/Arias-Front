import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { B2cOrderPage } from './B2cOrderPage';
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
  InsufficientCreditsError,
  LoyaltyDessertError,
  placeOrderV2,
  startDirectCheckoutV2,
  type OrderV2,
} from '@/features/orders/services/ordersApi';
import { getPacks, getWallet } from '@/features/credits/services/creditsApi';
import { getAvailableDesserts, getLoyalty } from '@/features/loyalty/services/loyaltyApi';
import { celebrationKey } from '@/features/loyalty/loyaltyStorage';
import type { Loyalty } from '@/features/loyalty/types';
import type { Dish } from '@/features/orders/types';
import { mockMatchMedia } from '@/test/matchMedia';

vi.mock('@/features/loyalty/services/loyaltyApi', () => ({
  getLoyalty: vi.fn(),
  getAvailableDesserts: vi.fn(),
}));
vi.mock('@/features/me/services/meApi', () => ({
  getReviewPrompt: vi.fn().mockResolvedValue({ show: false, dishName: null, reviewUrl: null }),
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

const DAY = 86_400_000;
const inDays = (n: number) => new Date(Date.now() + n * DAY).toISOString();
const startedAt = inDays(-17);
const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

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

const desserts = [
  { id: 4, nombre: 'Flan casero', descripcion: 'Con dulce de leche', fotoUrl: null, stockActual: 5 },
  { id: 5, nombre: 'Brownie', descripcion: null, fotoUrl: null, stockActual: 2 },
  { id: 6, nombre: 'Tiramisú', descripcion: null, fotoUrl: null, stockActual: 0 },
];

function placed(overrides: Partial<OrderV2> = {}): OrderV2 {
  return {
    id: 99,
    fecha: '2026-05-21',
    pickupAt: '2026-05-21T15:00:00Z',
    estado: 'PENDIENTE',
    creditTotal: 2,
    notas: null,
    items: [
      { id: 1, dishId: 10, dishNombre: 'Milanesa napolitana', dishCategoria: 'Básico', sideId: null, sideNombre: null, creditCost: 2, notas: null },
    ],
    rewardItems: [],
    cancellable: true,
    modifiable: true,
    pickupTimeChangeable: true,
    paidWithMercadoPago: false,
    creditsFromBalance: 0,
    ...overrides,
  };
}

function loyaltyWith(over: Record<string, unknown> = {}): Loyalty {
  return {
    enabled: true,
    cycle: { startedAt, endsAt: inDays(43), lunches: 7 },
    waiting: false,
    milestones: [
      { lunches: 6, kind: 'DESSERT', status: 'EARNED', expiresAt: inDays(3) },
      { lunches: 18, kind: 'LUNCH', status: 'LOCKED', expiresAt: null },
      { lunches: 24, kind: 'DISCOUNT', percent: 10, status: 'LOCKED', expiresAt: null },
    ],
    pendingDessert: { rewardId: 9, expiresAt: inDays(3) },
    ...over,
  } as Loyalty;
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <B2cOrderPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return queryClient;
}

async function addDishToCart() {
  fireEvent.click(await screen.findByRole('button', { name: /milanesa napolitana.*con papas fritas/i }));
  fireEvent.click(await screen.findByRole('button', { name: /agregar al pedido/i }));
}

const reviewSheet = () => screen.findByRole('dialog', { name: /tu pedido/i });

/** Elige un postre en el selector y vuelve a la revisión. */
async function pickDessert(name: RegExp) {
  fireEvent.click(await screen.findByRole('button', { name: /elegir postre|cambiar postre/i }));
  const picker = await screen.findByRole('dialog', { name: /elegí tu postre/i });
  fireEvent.click(await within(picker).findByRole('radio', { name }));
  fireEvent.click(within(picker).getByRole('button', { name: /sumar al pedido/i }));
  await waitFor(() => expect(screen.queryByRole('dialog', { name: /elegí tu postre/i })).not.toBeInTheDocument());
}

function setup({ loyalty = loyaltyWith() as Loyalty } = {}) {
  window.localStorage.setItem(celebrationKey(7, `DESSERT:6:${startedAt}`), '1');
  mockMatchMedia(false);
  useAuthStore.setState({ accessToken: 'token', user: baseUser, bootstrapping: false });
  vi.mocked(getLoyalty).mockResolvedValue(loyalty);
  vi.mocked(getAvailableDesserts).mockResolvedValue(desserts);
  vi.mocked(getMenuSections).mockResolvedValue([{ id: 1, nombre: 'Carnes', ordenDisplay: 1 }]);
  vi.mocked(getDisabledDates).mockResolvedValue([]);
  vi.mocked(getAvailableDishes).mockResolvedValue([dish]);
  vi.mocked(getPickupSlots).mockResolvedValue(['2026-05-21T15:00:00Z']);
  vi.mocked(getDishPreference).mockResolvedValue(null);
  vi.mocked(getOrdersV2).mockResolvedValue([]);
  vi.mocked(getRestaurantConfig).mockResolvedValue({ horaCorte: '10:00', pickupWindowStart: '11:00', pickupWindowEnd: '23:00' });
  vi.mocked(getWallet).mockResolvedValue({ available: 12, committed: 0, expiresAt: null });
  vi.mocked(getPacks).mockResolvedValue([
    { id: 1, code: 'DAY', packType: 'INDIVIDUAL', nombre: 'Sueltos', creditAmount: 1, priceCents: 150000, discountPercent: 0, ordenDisplay: 1, enabled: true, lema: null },
  ]);
}

afterEach(() => {
  useCartStore.getState().reset();
  useAuthStore.setState({ accessToken: null, user: null, bootstrapping: true });
  window.localStorage.clear();
  vi.clearAllMocks();
});

describe('B2cOrderPage — gift dessert in the order', () => {
  beforeEach(() => setup());

  it('offers the pending dessert in the review, lets the customer pick it, and sends rewardDessertId with the order', async () => {
    vi.mocked(placeOrderV2).mockResolvedValueOnce(placed({ rewardItems: [{ dessertId: 4, nombre: 'Flan casero' }] }));
    renderPage();
    await addDishToCart();
    await reviewSheet();

    expect(await screen.findByText('Tenés un postre de regalo')).toBeInTheDocument();
    await pickDessert(/flan casero/i);

    // Vuelve a la revisión con el postre sin cargo; los almuerzos del pedido no cambian.
    await reviewSheet();
    expect(screen.getByText('Postre de regalo — sin cargo')).toBeInTheDocument();
    expect(screen.getByText('Flan casero')).toBeInTheDocument();
    expect(screen.getByText('Este pedido usa').nextElementSibling).toHaveTextContent('2 almuerzos');

    fireEvent.click(await screen.findByRole('button', { name: /^retiro /i }));

    expect(await screen.findByText('¡Pedido confirmado!')).toBeInTheDocument();
    expect(placeOrderV2).toHaveBeenCalledWith({
      items: [{ dishId: 10, sideId: null, notas: null }],
      pickupAt: '2026-05-21T15:00:00Z',
      notas: null,
      rewardDessertId: 4,
    });
    // La comanda confirmada trae la línea del postre sin cargo, y el premio se refresca.
    expect(screen.getByText('Postre de regalo — Flan casero')).toBeInTheDocument();
    expect(screen.getByText('Sin cargo')).toBeInTheDocument();
    await waitFor(() => expect(vi.mocked(getLoyalty).mock.calls.length).toBeGreaterThan(1));
    expect(useCartStore.getState().reward).toBeNull();
  });

  it('changes the chosen dessert and removes it, and an order without it sends no rewardDessertId', async () => {
    vi.mocked(placeOrderV2).mockResolvedValueOnce(placed());
    renderPage();
    await addDishToCart();
    await reviewSheet();
    await pickDessert(/flan casero/i);
    await reviewSheet();

    fireEvent.click(await screen.findByRole('button', { name: /cambiar postre/i }));
    const picker = await screen.findByRole('dialog', { name: /elegí tu postre/i });
    // Cambiar arranca en el postre actual.
    expect(await within(picker).findByRole('radio', { name: /flan casero/i })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(within(picker).getByRole('radio', { name: /brownie/i }));
    fireEvent.click(within(picker).getByRole('button', { name: /sumar al pedido/i }));
    await reviewSheet();
    expect(await screen.findByText('Brownie')).toBeInTheDocument();
    expect(useCartStore.getState().reward?.dessertId).toBe(5);

    fireEvent.click(screen.getByRole('button', { name: /^quitar$/i }));
    expect(await screen.findByRole('button', { name: /elegir postre/i })).toBeInTheDocument();
    expect(useCartStore.getState().reward).toBeNull();

    fireEvent.click(await screen.findByRole('button', { name: /^retiro /i }));
    await screen.findByText('¡Pedido confirmado!');
    expect(vi.mocked(placeOrderV2).mock.calls[0][0]).not.toHaveProperty('rewardDessertId');
  });

  it('disables a dessert with no stock in the picker', async () => {
    renderPage();
    await addDishToCart();
    await reviewSheet();
    fireEvent.click(await screen.findByRole('button', { name: /elegir postre/i }));

    const picker = await screen.findByRole('dialog', { name: /elegí tu postre/i });
    expect(await within(picker).findByRole('radio', { name: /tiramisú/i })).toBeDisabled();
    expect(within(picker).getByText('Sin stock hoy')).toBeInTheDocument();
  });

  it.each([
    ['dessert-out-of-stock', 'Ese postre se terminó por hoy. Elegí otro.'],
    ['dessert-not-found', 'Ese postre ya no está disponible. Elegí otro.'],
    ['no-pending-dessert', 'Tu postre de regalo ya no está disponible.'],
    ['loyalty-disabled', 'Tu postre de regalo ya no está disponible.'],
  ] as const)('shows the friendly message for %s, drops the dessert and keeps the order usable', async (code, message) => {
    vi.mocked(placeOrderV2).mockRejectedValueOnce(new LoyaltyDessertError(code));
    renderPage();
    await addDishToCart();
    await reviewSheet();
    await pickDessert(/flan casero/i);
    await reviewSheet();
    fireEvent.click(await screen.findByRole('button', { name: /^retiro /i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.queryByText('¡Pedido confirmado!')).not.toBeInTheDocument();
    expect(useCartStore.getState().reward).toBeNull();
    expect(useCartStore.getState().byDate[Object.keys(useCartStore.getState().byDate)[0]]).toHaveLength(1);
    // Se puede volver a elegir y confirmar.
    expect(screen.getByRole('button', { name: /^retiro /i })).toBeEnabled();
    if (code === 'dessert-out-of-stock') {
      // Hay que refrescar el stock para que el selector no ofrezca el postre agotado.
      const before = vi.mocked(getAvailableDesserts).mock.calls.length;
      fireEvent.click(await screen.findByRole('button', { name: /elegir postre/i }));
      await screen.findByRole('dialog', { name: /elegí tu postre/i });
      await waitFor(() => expect(vi.mocked(getAvailableDesserts).mock.calls.length).toBeGreaterThan(before));
    }
  });

  it('refreshes the line when the dessert is no longer there (no-pending-dessert)', async () => {
    vi.mocked(placeOrderV2).mockRejectedValueOnce(new LoyaltyDessertError('no-pending-dessert'));
    renderPage();
    await addDishToCart();
    await reviewSheet();
    await pickDessert(/flan casero/i);
    await reviewSheet();
    const before = vi.mocked(getLoyalty).mock.calls.length;
    fireEvent.click(await screen.findByRole('button', { name: /^retiro /i }));

    await screen.findByRole('alert');
    await waitFor(() => expect(vi.mocked(getLoyalty).mock.calls.length).toBeGreaterThan(before));
  });

  it('sends rewardDessertId on direct checkout and sends the customer back to the review if the dessert failed', async () => {
    vi.mocked(placeOrderV2).mockRejectedValue(new InsufficientCreditsError());
    vi.mocked(startDirectCheckoutV2).mockRejectedValueOnce(new LoyaltyDessertError('dessert-out-of-stock'));
    renderPage();
    await addDishToCart();
    await reviewSheet();
    await pickDessert(/flan casero/i);
    await reviewSheet();
    fireEvent.click(await screen.findByRole('button', { name: /^retiro /i }));

    await screen.findByText('Pagá este pedido con Mercado Pago');
    fireEvent.click(await screen.findByRole('button', { name: /pagar \$\s?3\.000(?!,) con mercado pago/i }));

    await waitFor(() =>
      expect(startDirectCheckoutV2).toHaveBeenCalledWith({
        items: [{ dishId: 10, sideId: null, notas: null }],
        pickupAt: '2026-05-21T15:00:00Z',
        notas: null,
        rewardDessertId: 4,
      }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('Ese postre se terminó por hoy. Elegí otro.');
    expect(await reviewSheet()).toBeInTheDocument();
    expect(useCartStore.getState().reward).toBeNull();
  });

  it('drops the chosen dessert when the pending dessert is gone', async () => {
    vi.mocked(getLoyalty).mockResolvedValue(loyaltyWith({ pendingDessert: null }));
    useCartStore.getState().addLine(todayIso(), {
      localId: 'seed',
      dish,
      sideId: null,
      sideNombre: null,
      notas: null,
    });
    const day = Object.keys(useCartStore.getState().byDate)[0];
    useCartStore.getState().setReward({ fecha: day, dessertId: 4, nombre: 'Flan casero', fotoUrl: null });
    renderPage();

    await waitFor(() => expect(useCartStore.getState().reward).toBeNull());
  });

  it('says the dessert goes in a new order when the cart would be added to an existing one', async () => {
    const order = placed({ fecha: todayIso() });
    vi.mocked(getOrdersV2).mockResolvedValue([order]);
    renderPage();
    await addDishToCart();
    await reviewSheet();

    expect(await screen.findByText(/va en un pedido nuevo/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /elegir postre/i })).not.toBeInTheDocument();
  });
});

describe('B2cOrderPage — using the dessert from the benefits line', () => {
  beforeEach(() => setup());

  it('guides to pick a lunch first when the cart is empty', async () => {
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /postre de regalo · vence en 3 días · usar/i }));

    expect(await screen.findByText(/va con un almuerzo/i)).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: /elegí tu postre/i })).not.toBeInTheDocument();
  });

  it('opens the picker straight away when the cart already has a lunch', async () => {
    renderPage();
    await addDishToCart();
    const sheet = await reviewSheet();
    fireEvent.keyDown(sheet, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /tu pedido/i })).not.toBeInTheDocument());

    fireEvent.click(await screen.findByRole('button', { name: /postre de regalo · vence en 3 días · usar/i }));

    expect(await screen.findByRole('dialog', { name: /elegí tu postre/i })).toBeInTheDocument();
  });
});

describe('B2cOrderPage — lunches missing for the dessert', () => {
  it('shows "Te faltan N almuerzos" in the review when the dessert is not earned yet', async () => {
    setup({
      loyalty: loyaltyWith({
        cycle: { startedAt, endsAt: inDays(43), lunches: 4 },
        pendingDessert: null,
        milestones: [{ lunches: 6, kind: 'DESSERT', status: 'LOCKED', expiresAt: null }],
      }),
    });
    renderPage();
    await addDishToCart();
    await reviewSheet();

    expect(await screen.findByText('Te faltan 2 almuerzos para tu postre de regalo.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /elegir postre/i })).not.toBeInTheDocument();
  });

  it('shows nothing about desserts when the line is disabled', async () => {
    setup({ loyalty: { enabled: false } });
    renderPage();
    await addDishToCart();
    await reviewSheet();
    await screen.findByRole('button', { name: /^retiro /i });

    expect(screen.queryByText(/postre/i)).not.toBeInTheDocument();
  });
});
