import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { B2cOrderPage } from './B2cOrderPage';
import { useAuthStore, type AuthUser } from '@/features/auth/store/authStore';
import {
  getAvailableDishes,
  getDisabledDates,
  getDishPreference,
  getMenuSections,
  getOrdersV2,
  getPickupSlots,
  getRestaurantConfig,
  InsufficientCreditsError,
  placeOrderV2,
  type OrderV2,
} from '@/features/orders/services/ordersApi';
import { getWallet } from '@/features/credits/services/creditsApi';
import type { Dish } from '@/features/orders/types';

vi.mock('@/features/orders/services/ordersApi', async () => {
  const actual = await vi.importActual<typeof import('@/features/orders/services/ordersApi')>(
    '@/features/orders/services/ordersApi',
  );
  return {
    ...actual,
    getAvailableDishes: vi.fn(),
    getDisabledDates: vi.fn(),
    getDishPreference: vi.fn(),
    getMenuSections: vi.fn(),
    getOrdersV2: vi.fn(),
    getPickupSlots: vi.fn(),
    getRestaurantConfig: vi.fn(),
    placeOrderV2: vi.fn(),
  };
});

vi.mock('@/features/credits/services/creditsApi', () => ({
  getWallet: vi.fn(),
}));

/** Replica el algoritmo de `WeekDaySelector` para ubicar, de forma
 * determinística y sin importar qué día corre la suite, un lunes y un
 * martes de la SEMANA SIGUIENTE — siempre futuros, así que el tilde nunca
 * lo suprime `isPast`. */
function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function nextWeekMondayAndTuesday(): [string, string] {
  const today = new Date();
  const dow = today.getDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const currentMonday = new Date(today);
  currentMonday.setDate(today.getDate() + mondayOffset);
  const nextMonday = new Date(currentMonday);
  nextMonday.setDate(currentMonday.getDate() + 7);
  const nextTuesday = new Date(nextMonday);
  nextTuesday.setDate(nextMonday.getDate() + 1);
  return [toIso(nextMonday), toIso(nextTuesday)];
}

const baseUser: AuthUser = {
  id: 7,
  email: 'cliente@example.com',
  firstName: 'Lucía',
  lastName: null,
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

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <B2cOrderPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...view, queryClient };
}

async function addDishToCart() {
  fireEvent.click(await screen.findByRole('button', { name: /milanesa napolitana/i }));
  fireEvent.click(await screen.findByRole('button', { name: /agregar al pedido/i }));
}

async function openReview() {
  fireEvent.click(await screen.findByRole('button', { name: /ver pedido/i }));
}

describe('B2cOrderPage — credits cart flow (B2C, no company)', () => {
  beforeEach(() => {
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
  });

  afterEach(() => {
    useAuthStore.setState({ accessToken: null, user: null, bootstrapping: true });
    vi.clearAllMocks();
  });

  /**
   * F4: el detalle de plato pasa a ser una hoja (`DishSheet`) y el carrito
   * (con el horario de retiro y el botón de confirmar) vive en la hoja de
   * revisión (`OrderReviewSheet`), que se abre con "Ver pedido" en la barra
   * inferior — ya no está siempre visible bajo el menú.
   */
  it('adds a dish to the cart and shows its cost in "almuerzos", never "créditos"', async () => {
    renderPage();

    await addDishToCart();
    await openReview();

    // El costo de la línea, el total del carrito y "Este pedido usa" en el
    // cálculo de saldo (display-only) — los tres dicen "2 almuerzos".
    expect(await screen.findAllByText('2 almuerzos')).toHaveLength(3);
    expect(screen.queryByText(/crédito/i)).not.toBeInTheDocument();
  });

  /**
   * Comportamiento cambiado intencionalmente por F3: `PickupTimePicker`
   * preselecciona automáticamente "Última utilizada"/"Lo antes posible" en
   * vez de exigir un click sobre una franja horaria (igual que el
   * prototipo aprobado, donde el readout y el botón ya muestran un horario
   * válido apenas cargan los slots). El único caso que deshabilita
   * "Confirmar" por horario es que no haya NINGÚN slot para el día.
   */
  it('auto-enables the confirm button with the default pickup option, no extra click needed', async () => {
    renderPage();

    await addDishToCart();
    await openReview();

    const confirmButton = await screen.findByRole('button', { name: /^retiro /i });
    expect(confirmButton).not.toBeDisabled();
  });

  it('keeps the confirm button disabled when there are no pickup slots for the selected day', async () => {
    vi.mocked(getPickupSlots).mockResolvedValue([]);
    renderPage();

    await addDishToCart();
    await openReview();

    expect(
      await screen.findByText(/no quedan horarios de retiro para este día/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^confirmar pedido$/i })).toBeDisabled();
  });

  it('confirms the order against POST /api/v2/orders with the exact cart items and the auto-selected pickup slot', async () => {
    vi.mocked(placeOrderV2).mockResolvedValueOnce({
      id: 99,
      fecha: '2026-05-21',
      pickupAt: '2026-05-21T15:00:00Z',
      estado: 'PENDIENTE',
      creditTotal: 2,
      notas: null,
      items: [],
      cancellable: true,
    });
    renderPage();

    await addDishToCart();
    await openReview();
    fireEvent.click(await screen.findByRole('button', { name: /^retiro /i }));

    expect(await screen.findByText('¡Pedido confirmado!')).toBeInTheDocument();
    expect(placeOrderV2).toHaveBeenCalledWith({
      items: [{ dishId: 10, sideId: null, notas: null }],
      pickupAt: '2026-05-21T15:00:00Z',
      notas: null,
    });
  });

  it('surfaces insufficient balance from the backend without calculating it on the client', async () => {
    vi.mocked(placeOrderV2).mockRejectedValueOnce(new InsufficientCreditsError());
    renderPage();

    await addDishToCart();
    await openReview();
    fireEvent.click(await screen.findByRole('button', { name: /^retiro /i }));

    expect(
      await screen.findByText(/no te alcanzan los almuerzos disponibles/i),
    ).toBeInTheDocument();
    expect(screen.queryByText('¡Pedido confirmado!')).not.toBeInTheDocument();
  });

  /**
   * Corrección F7.1: `B2cOrderPage` usaba la clave `['creditWallet']`,
   * distinta de `['creditsWallet']` (el `useWallet` que respaldan el chip
   * del header y `WalletBalance`, y `CreditsPacksPage`) — invalidar tras un
   * pedido no refrescaba el chip. Ahora comparten la misma clave.
   */
  it('invalidates the shared wallet cache key after a successful order, so the header stays in sync', async () => {
    vi.mocked(placeOrderV2).mockResolvedValueOnce({
      id: 99,
      fecha: '2026-05-21',
      pickupAt: '2026-05-21T15:00:00Z',
      estado: 'PENDIENTE',
      creditTotal: 2,
      notas: null,
      items: [],
      cancellable: true,
    });
    const { queryClient } = renderPage();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await addDishToCart();
    await openReview();
    fireEvent.click(await screen.findByRole('button', { name: /^retiro /i }));

    await screen.findByText('¡Pedido confirmado!');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['creditsWallet'] });
  });

  /**
   * Corrección F7.1: quitar la única línea desde la hoja de revisión la
   * cerraba (por `cart.lines.length > 0` en el `open`), pero `reviewOpen`
   * seguía en `true` — agregar el próximo plato la reabría sin que el
   * usuario lo pidiera.
   */
  it('does not reopen the review sheet automatically after removing the only line and adding a dish again', async () => {
    renderPage();

    await addDishToCart();
    await openReview();

    fireEvent.click(
      await screen.findByRole('button', { name: /quitar milanesa napolitana del carrito/i }),
    );
    await vi.waitFor(() =>
      expect(screen.queryByRole('dialog', { name: /tu pedido/i })).not.toBeInTheDocument(),
    );

    await addDishToCart();

    expect(screen.queryByRole('dialog', { name: /tu pedido/i })).not.toBeInTheDocument();
  });
});

describe('B2cOrderPage — day strip, headings and pickup window (F2)', () => {
  beforeEach(() => {
    useAuthStore.setState({ accessToken: 'token', user: baseUser, bootstrapping: false });
    vi.mocked(getMenuSections).mockResolvedValue([{ id: 1, nombre: 'Carnes', ordenDisplay: 1 }]);
    vi.mocked(getDisabledDates).mockResolvedValue([]);
    vi.mocked(getAvailableDishes).mockResolvedValue([dish]);
    vi.mocked(getPickupSlots).mockResolvedValue(['2026-05-21T15:00:00Z']);
    vi.mocked(getDishPreference).mockResolvedValue(null);
    vi.mocked(getRestaurantConfig).mockResolvedValue({
      horaCorte: '10:00',
      pickupWindowStart: '11:00',
      pickupWindowEnd: '23:00',
    });
    vi.mocked(getWallet).mockResolvedValue({ available: 12, committed: 0, expiresAt: null });
  });

  afterEach(() => {
    useAuthStore.setState({ accessToken: null, user: null, bootstrapping: true });
    vi.clearAllMocks();
  });

  it('shows a check on a day with an active order and not on a day with only a cancelled order', async () => {
    const [activeDate, cancelledOnlyDate] = nextWeekMondayAndTuesday();
    const order = (overrides: Partial<OrderV2>): OrderV2 => ({
      id: 1,
      fecha: activeDate,
      pickupAt: `${activeDate}T15:00:00Z`,
      estado: 'PENDIENTE',
      creditTotal: 2,
      notas: null,
      items: [],
      cancellable: true,
      ...overrides,
    });
    vi.mocked(getOrdersV2).mockResolvedValue([
      order({ id: 1, fecha: activeDate, estado: 'PENDIENTE' }),
      order({ id: 2, fecha: cancelledOnlyDate, estado: 'CANCELADO', cancellable: false }),
    ]);

    renderPage();

    const activeDayButton = (
      await screen.findByText(String(Number(activeDate.split('-')[2])))
    ).closest('button');
    const cancelledDayButton = screen
      .getByText(String(Number(cancelledOnlyDate.split('-')[2])))
      .closest('button');

    expect(activeDayButton?.querySelector('svg')).toBeTruthy();
    expect(cancelledDayButton?.querySelector('svg')).toBeFalsy();
  });

  it('shows the today heading and pill, and switches to the scheduled heading and pill for a future day', async () => {
    const [futureDate] = nextWeekMondayAndTuesday();
    vi.mocked(getOrdersV2).mockResolvedValue([]);

    renderPage();

    expect(await screen.findByText('¡Buen día, Lucía!')).toBeInTheDocument();
    expect(screen.getByText('¿Qué querés comer hoy?')).toBeInTheDocument();
    expect(screen.getByText('Menú de hoy')).toBeInTheDocument();

    const futureDayButton = screen
      .getByText(String(Number(futureDate.split('-')[2])))
      .closest('button');
    fireEvent.click(futureDayButton!);

    expect(await screen.findByText('¿Qué querés comer?')).toBeInTheDocument();
    expect(screen.getByText('Pedido programado')).toBeInTheDocument();
    expect(screen.queryByText('¿Qué querés comer hoy?')).not.toBeInTheDocument();
  });

  it('shows the pickup window from the restaurant config next to a clock icon', async () => {
    vi.mocked(getOrdersV2).mockResolvedValue([]);
    vi.mocked(getRestaurantConfig).mockResolvedValue({
      horaCorte: '10:00',
      pickupWindowStart: '11:30',
      pickupWindowEnd: '22:45',
    });

    renderPage();

    expect(await screen.findByText('11:30 – 22:45')).toBeInTheDocument();
  });
});

describe('B2cOrderPage — pickup time picker (F3)', () => {
  beforeEach(() => {
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
  });

  afterEach(() => {
    useAuthStore.setState({ accessToken: null, user: null, bootstrapping: true });
    vi.clearAllMocks();
  });

  it('shows "Retiro hoy HH:MM hs" for today and switches to "Retiro <día> a las HH:MM" for a future day', async () => {
    const [futureDate] = nextWeekMondayAndTuesday();
    renderPage();

    await addDishToCart();
    await openReview();

    expect(
      await screen.findByRole('button', { name: /^retiro hoy \d{2}:\d{2} hs$/i }),
    ).toBeInTheDocument();

    // El carrito no depende del día seleccionado — cambiar de día con la
    // hoja de revisión abierta re-pide los horarios para la nueva fecha y
    // el botón de confirmar se actualiza solo (mismo comportamiento de F3).
    const futureDayButton = screen
      .getByText(String(Number(futureDate.split('-')[2])))
      .closest('button');
    fireEvent.click(futureDayButton!);

    const dayShort = new Date(`${futureDate}T12:00:00`).toLocaleDateString('es-AR', {
      weekday: 'long',
      day: 'numeric',
    });
    expect(
      await screen.findByRole('button', {
        name: new RegExp(`^retiro ${dayShort} a las \\d{2}:\\d{2}$`, 'i'),
      }),
    ).toBeInTheDocument();
  });
});
