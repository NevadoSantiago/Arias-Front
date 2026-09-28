import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { B2cOrderPage } from './B2cOrderPage';
import { useAuthStore, type AuthUser } from '@/features/auth/store/authStore';
import {
  addOrderItemsV2,
  cancelOrderV2,
  getAvailableDishes,
  getDisabledDates,
  getDishPreference,
  getMenuSections,
  getOrdersV2,
  getPickupSlots,
  getRestaurantConfig,
  InsufficientCreditsError,
  OrderNotModifiableError,
  placeOrderV2,
  removeOrderItemV2,
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
    // Los tests de F14b fijan el reloj; si una aserción falla antes de su
    // useRealTimers(), el reloj falso no debe filtrarse a los tests siguientes.
    vi.useRealTimers();
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

  /**
   * F14b: la línea del horario de retiro deja de leer el par global
   * (deprecated) y pasa a leer `pickupSchedule` del día de la semana
   * SELECCIONADO — no del día de hoy. Se ancla el reloj del sistema a un
   * sábado real (sin usar `WeekDaySelector` para llegar ahí) porque solo
   * ese día tiene un chip de "hoy" propio cuando cae en fin de semana (F13);
   * el lunes de la semana siguiente ya es clickeable desde ese mismo chip.
   */
  it("shows the selected day's own window from pickupSchedule (Saturday, then Monday)", async () => {
    vi.setSystemTime(new Date('2026-09-26T09:00:00'));
    vi.mocked(getOrdersV2).mockResolvedValue([]);
    vi.mocked(getRestaurantConfig).mockResolvedValue({
      horaCorte: '10:00',
      pickupWindowStart: '11:00',
      pickupWindowEnd: '23:00',
      pickupSchedule: [
        { dayOfWeek: 1, open: true, windowStart: '08:00', windowEnd: '20:00' },
        { dayOfWeek: 2, open: true, windowStart: '11:00', windowEnd: '23:00' },
        { dayOfWeek: 3, open: true, windowStart: '11:00', windowEnd: '23:00' },
        { dayOfWeek: 4, open: true, windowStart: '11:00', windowEnd: '23:00' },
        { dayOfWeek: 5, open: true, windowStart: '11:00', windowEnd: '23:00' },
        { dayOfWeek: 6, open: true, windowStart: '10:00', windowEnd: '15:00' },
        { dayOfWeek: 7, open: false, windowStart: null, windowEnd: null },
      ],
    });

    renderPage();

    expect(await screen.findByText('10:00 – 15:00')).toBeInTheDocument();

    const mondayButton = screen.getByText('Lu').closest('button');
    fireEvent.click(mondayButton!);

    expect(await screen.findByText('08:00 – 20:00')).toBeInTheDocument();
    expect(screen.queryByText('10:00 – 15:00')).not.toBeInTheDocument();

    vi.useRealTimers();
  });

  /** F14b: un día cerrado en `pickupSchedule` muestra un texto de cerrado en vez de un rango. */
  it('shows a closed message instead of a time range for a closed weekday', async () => {
    vi.setSystemTime(new Date('2026-06-01T09:00:00')); // lunes
    vi.mocked(getOrdersV2).mockResolvedValue([]);
    vi.mocked(getRestaurantConfig).mockResolvedValue({
      horaCorte: '10:00',
      pickupWindowStart: '11:00',
      pickupWindowEnd: '23:00',
      pickupSchedule: [
        { dayOfWeek: 1, open: false, windowStart: null, windowEnd: null },
        { dayOfWeek: 2, open: true, windowStart: '11:00', windowEnd: '23:00' },
        { dayOfWeek: 3, open: true, windowStart: '11:00', windowEnd: '23:00' },
        { dayOfWeek: 4, open: true, windowStart: '11:00', windowEnd: '23:00' },
        { dayOfWeek: 5, open: true, windowStart: '11:00', windowEnd: '23:00' },
        { dayOfWeek: 6, open: true, windowStart: '11:00', windowEnd: '16:00' },
        { dayOfWeek: 7, open: false, windowStart: null, windowEnd: null },
      ],
    });

    renderPage();

    expect(await screen.findByText(/cerrado ese día/i)).toBeInTheDocument();
    expect(screen.queryByText(/–/)).not.toBeInTheDocument();

    vi.useRealTimers();
  });

  /** F14b: tolerancia a un backend viejo sin `pickupSchedule` — cae al par global. */
  it('falls back to the global pickupWindowStart/End when pickupSchedule is missing', async () => {
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

    // F12: el carrito es por día — cambiar de día con la hoja de revisión
    // abierta muestra el carrito (vacío) del día nuevo, así que la hoja se
    // cierra sola (mismo criterio que quitar la última línea, F7.1). Hay que
    // agregar un plato en ese día para volver a abrirla y ver su horario.
    const futureDayButton = screen
      .getByText(String(Number(futureDate.split('-')[2])))
      .closest('button');
    fireEvent.click(futureDayButton!);

    await vi.waitFor(() =>
      expect(screen.queryByRole('dialog', { name: /tu pedido/i })).not.toBeInTheDocument(),
    );

    await addDishToCart();
    await openReview();

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

describe('B2cOrderPage — hides stock indicators on future days (F8.1)', () => {
  const lowStockDish: Dish = { ...dish, stockActual: 2 };

  beforeEach(() => {
    useAuthStore.setState({ accessToken: 'token', user: baseUser, bootstrapping: false });
    vi.mocked(getMenuSections).mockResolvedValue([{ id: 1, nombre: 'Carnes', ordenDisplay: 1 }]);
    vi.mocked(getDisabledDates).mockResolvedValue([]);
    vi.mocked(getAvailableDishes).mockResolvedValue([lowStockDish]);
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
   * F8.1: como `CompanyOrderPage` ya hace con `isFuture`, el stock (badge de
   * "Últimos N" y el bloqueo por "Sin stock") solo aplica al día de hoy —
   * un día futuro no tiene stock real todavía.
   */
  it('shows the low-stock badge today and hides it for a future day', async () => {
    const [futureDate] = nextWeekMondayAndTuesday();
    renderPage();

    expect(await screen.findByText(/Últimos 2/i)).toBeInTheDocument();

    const futureDayButton = screen
      .getByText(String(Number(futureDate.split('-')[2])))
      .closest('button');
    fireEvent.click(futureDayButton!);

    await screen.findByText('¿Qué querés comer?');
    expect(screen.queryByText(/Últimos/i)).not.toBeInTheDocument();
  });
});

describe('B2cOrderPage — the cart is independent per day (F12)', () => {
  const dish2: Dish = {
    ...dish,
    id: 11,
    nombre: 'Tarta de verdura',
  };
  // `WeekDaySelector` only renders Mon–Fri, so a real "today" that falls on
  // a weekend has no clickable button to come back to. The system clock is
  // pinned to a known Monday for this suite (mocks only `Date`, real
  // timers keep running — `findBy`/`waitFor` still resolve normally).
  const TODAY = '2026-06-01T09:00:00';
  const TODAY_ISO = '2026-06-01';
  const FUTURE_ISO = '2026-06-02';

  function dayButton(iso: string) {
    // With two dishes in the same section, `FilterPills`' count badge can
    // show the same digit as a day number (both plain "2", say) — exclude
    // matches inside the section tablist to keep this unambiguous.
    const day = String(Number(iso.split('-')[2]));
    const match = screen.getAllByText(day).find((el) => !el.closest('[role="tablist"]'));
    return match?.closest('button');
  }

  beforeEach(() => {
    vi.setSystemTime(new Date(TODAY));
    useAuthStore.setState({ accessToken: 'token', user: baseUser, bootstrapping: false });
    vi.mocked(getMenuSections).mockResolvedValue([{ id: 1, nombre: 'Carnes', ordenDisplay: 1 }]);
    vi.mocked(getDisabledDates).mockResolvedValue([]);
    vi.mocked(getAvailableDishes).mockResolvedValue([dish, dish2]);
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
    vi.useRealTimers();
  });

  it('keeps a dish added today off a future day, and keeps it after switching back', async () => {
    renderPage();

    await addDishToCart();
    expect(await screen.findByRole('button', { name: /ver pedido/i })).toBeInTheDocument();

    fireEvent.click(dayButton(FUTURE_ISO)!);
    await screen.findByText('¿Qué querés comer?');
    expect(screen.queryByRole('button', { name: /ver pedido/i })).not.toBeInTheDocument();
    expect(screen.getByText(/tocá un plato para armar tu pedido/i)).toBeInTheDocument();

    fireEvent.click(await screen.findByRole('button', { name: /tarta de verdura/i }));
    fireEvent.click(await screen.findByRole('button', { name: /agregar al pedido/i }));
    expect(await screen.findByText(/^1 plato/i)).toBeInTheDocument();

    fireEvent.click(dayButton(TODAY_ISO)!);
    await openReview();
    const reviewDialog = await screen.findByRole('dialog', { name: /tu pedido/i });
    expect(within(reviewDialog).getByText('Milanesa napolitana')).toBeInTheDocument();
    expect(within(reviewDialog).queryByText('Tarta de verdura')).not.toBeInTheDocument();
  });

  it('confirms only the selected day items and leaves other days carts untouched', async () => {
    vi.mocked(placeOrderV2).mockResolvedValueOnce({
      id: 100,
      fecha: FUTURE_ISO,
      pickupAt: '2026-05-21T15:00:00Z',
      estado: 'PENDIENTE',
      creditTotal: 3,
      notas: null,
      items: [],
      cancellable: true,
    });
    renderPage();

    await addDishToCart();

    fireEvent.click(dayButton(FUTURE_ISO)!);
    await screen.findByText('¿Qué querés comer?');
    fireEvent.click(await screen.findByRole('button', { name: /tarta de verdura/i }));
    fireEvent.click(await screen.findByRole('button', { name: /agregar al pedido/i }));

    await openReview();
    fireEvent.click(await screen.findByRole('button', { name: /^retiro /i }));

    expect(await screen.findByText('¡Pedido programado!')).toBeInTheDocument();
    expect(placeOrderV2).toHaveBeenCalledWith({
      items: [{ dishId: dish2.id, sideId: null, notas: null }],
      pickupAt: '2026-05-21T15:00:00Z',
      notas: null,
    });

    fireEvent.click(await screen.findByRole('button', { name: /volver al menú/i }));
    fireEvent.click(dayButton(TODAY_ISO)!);
    await openReview();
    const reviewDialog = await screen.findByRole('dialog', { name: /tu pedido/i });
    expect(within(reviewDialog).getByText('Milanesa napolitana')).toBeInTheDocument();
  });
});

describe('B2cOrderPage — offers today on weekends (F13)', () => {
  const SATURDAY = '2026-09-26T09:00:00';
  const SATURDAY_ISO = '2026-09-26';

  beforeEach(() => {
    vi.setSystemTime(new Date(SATURDAY));
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
    vi.useRealTimers();
  });

  /**
   * F13: `WeekDaySelector` solo muestra lunes a viernes, así que un sábado o
   * domingo reales no tenían ningún chip de "hoy" — el cliente no podía
   * pedir el mismo día de fin de semana aunque el backend ya lo permite
   * (`PickupSlotService.isWithinSchedulableWeeks`, semana lunes-domingo).
   */
  it('shows a today chip (Sáb) on a Saturday, selected by default, and requests the menu for today', async () => {
    renderPage();

    // El saludo de "hoy" ya confirma que `selectedDate` arranca en el
    // sábado real (no cambió con esta feature: `todayStr` ya era la fecha
    // inicial); lo nuevo es que ahora existe un chip para volver a hoy.
    await screen.findByText('¡Buen día, Lucía!');

    const todayButton = screen.getByText('Sáb').closest('button');
    expect(todayButton).not.toBeNull();
    expect(todayButton).not.toBeDisabled();

    expect(getAvailableDishes).toHaveBeenCalledWith(SATURDAY_ISO);
  });
});

describe('B2cOrderPage — shows the selected day existing orders (F15)', () => {
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
    vi.useRealTimers();
  });

  function orderFor(fecha: string, overrides: Partial<OrderV2> = {}): OrderV2 {
    return {
      id: 501,
      fecha,
      pickupAt: `${fecha}T15:00:00Z`,
      estado: 'PENDIENTE',
      creditTotal: 2,
      notas: null,
      items: [
        {
          id: 1,
          dishId: 10,
          dishNombre: 'Milanesa napolitana',
          dishCategoria: 'Básico',
          sideId: null,
          sideNombre: null,
          creditCost: 2,
          notas: null,
        },
      ],
      cancellable: true,
      ...overrides,
    };
  }

  async function clickFutureDay(futureDate: string) {
    const futureDayButton = (
      await screen.findByText(String(Number(futureDate.split('-')[2])))
    ).closest('button');
    fireEvent.click(futureDayButton!);
  }

  it('shows a section with the dish, pickup time and status badge for a day with a non-cancelled order', async () => {
    const [futureDate] = nextWeekMondayAndTuesday();
    vi.mocked(getOrdersV2).mockResolvedValue([orderFor(futureDate)]);

    renderPage();
    await clickFutureDay(futureDate);

    const section = await screen.findByTestId('selected-day-orders');
    expect(within(section).getByText(/^tu pedido para/i)).toBeInTheDocument();
    expect(within(section).getByText('Milanesa napolitana')).toBeInTheDocument();
    expect(within(section).getByText(/retiro \d{2}:\d{2} hs/i)).toBeInTheDocument();
    expect(within(section).getByText('Programado')).toBeInTheDocument();
  });

  it('does not show the section for a day without orders', async () => {
    vi.mocked(getOrdersV2).mockResolvedValue([]);

    renderPage();

    await screen.findByText('¡Buen día, Lucía!');
    expect(screen.queryByTestId('selected-day-orders')).not.toBeInTheDocument();
  });

  it('does not show the section for a day with only a cancelled order', async () => {
    const [futureDate] = nextWeekMondayAndTuesday();
    vi.mocked(getOrdersV2).mockResolvedValue([
      orderFor(futureDate, { estado: 'CANCELADO', cancellable: false }),
    ]);

    renderPage();
    await clickFutureDay(futureDate);

    await screen.findByText('¿Qué querés comer?');
    expect(screen.queryByTestId('selected-day-orders')).not.toBeInTheDocument();
  });

  it('offers "Cancelar pedido" only when the order is cancellable', async () => {
    const [futureDate] = nextWeekMondayAndTuesday();
    vi.mocked(getOrdersV2).mockResolvedValue([orderFor(futureDate, { cancellable: false })]);

    renderPage();
    await clickFutureDay(futureDate);

    await screen.findByTestId('selected-day-orders');
    expect(screen.queryByRole('button', { name: /cancelar pedido/i })).not.toBeInTheDocument();
  });

  it('opens the cancel sheet and cancels the order, invalidating ordersV2 and creditsWallet', async () => {
    const [futureDate] = nextWeekMondayAndTuesday();
    vi.mocked(getOrdersV2).mockResolvedValue([orderFor(futureDate, { id: 777 })]);
    vi.mocked(cancelOrderV2).mockResolvedValueOnce(undefined);

    const { queryClient } = renderPage();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    await clickFutureDay(futureDate);

    await screen.findByTestId('selected-day-orders');
    fireEvent.click(await screen.findByRole('button', { name: /cancelar pedido/i }));
    expect(await screen.findByText('¿Cancelar este pedido?')).toBeInTheDocument();

    fireEvent.click(await screen.findByRole('button', { name: /sí, cancelar pedido/i }));

    await waitFor(() => expect(vi.mocked(cancelOrderV2).mock.calls[0]?.[0]).toBe(777));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['ordersV2'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['creditsWallet'] });
  });

  it('shows the plural heading when there are two orders for the same day', async () => {
    const [futureDate] = nextWeekMondayAndTuesday();
    vi.mocked(getOrdersV2).mockResolvedValue([
      orderFor(futureDate, { id: 1 }),
      orderFor(futureDate, {
        id: 2,
        items: [
          {
            id: 2,
            dishId: 11,
            dishNombre: 'Ensalada',
            dishCategoria: 'Básico',
            sideId: null,
            sideNombre: null,
            creditCost: 1,
            notas: null,
          },
        ],
      }),
    ]);

    renderPage();
    await clickFutureDay(futureDate);

    const section = await screen.findByTestId('selected-day-orders');
    expect(within(section).getByText(/^tus pedidos para/i)).toBeInTheDocument();
  });
});

describe('B2cOrderPage — adding to the day\'s existing modifiable order (F16)', () => {
  // Fecha fija (mismo patrón que F12/F13): así "hoy" es directamente el día
  // del pedido existente, sin depender de a qué día del selector hay que
  // hacer click.
  const TODAY = '2026-06-01T09:00:00';
  const TODAY_ISO = '2026-06-01';

  function orderFor(overrides: Partial<OrderV2> = {}): OrderV2 {
    return {
      id: 900,
      fecha: TODAY_ISO,
      pickupAt: `${TODAY_ISO}T15:00:00Z`,
      estado: 'PENDIENTE',
      creditTotal: 1,
      notas: null,
      // Nombre distinto de "Milanesa napolitana" (el plato del menú que usa
      // `addDishToCart`) para que sus botones no se confundan por texto.
      items: [
        {
          id: 1,
          dishId: 20,
          dishNombre: 'Ensalada',
          dishCategoria: 'Básico',
          sideId: null,
          sideNombre: null,
          creditCost: 1,
          notas: null,
        },
      ],
      cancellable: true,
      ...overrides,
    };
  }

  beforeEach(() => {
    vi.setSystemTime(new Date(TODAY));
    useAuthStore.setState({ accessToken: 'token', user: baseUser, bootstrapping: false });
    vi.mocked(getMenuSections).mockResolvedValue([{ id: 1, nombre: 'Carnes', ordenDisplay: 1 }]);
    vi.mocked(getDisabledDates).mockResolvedValue([]);
    vi.mocked(getAvailableDishes).mockResolvedValue([dish]);
    vi.mocked(getPickupSlots).mockResolvedValue(['2026-06-01T18:00:00Z']);
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
    vi.useRealTimers();
  });

  it('switches the review sheet to add mode and calls addOrderItemsV2 with the order id and cart items', async () => {
    vi.mocked(getOrdersV2).mockResolvedValue([orderFor()]);
    vi.mocked(addOrderItemsV2).mockResolvedValueOnce({
      ...orderFor(),
      creditTotal: 3,
      items: [
        ...orderFor().items,
        { id: 2, dishId: 10, dishNombre: 'Milanesa napolitana', dishCategoria: 'Básico', sideId: null, sideNombre: null, creditCost: 2, notas: null },
      ],
    });
    const { queryClient } = renderPage();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await addDishToCart();
    await openReview();

    expect(
      await screen.findByText(/se agrega a tu pedido de las \d{2}:\d{2}/i),
    ).toBeInTheDocument();
    expect(screen.queryByText('¿A qué hora lo retirás?')).not.toBeInTheDocument();

    fireEvent.click(await screen.findByRole('button', { name: /^agregar a mi pedido$/i }));

    await waitFor(() =>
      expect(addOrderItemsV2).toHaveBeenCalledWith(900, [{ dishId: 10, sideId: null, notas: null }]),
    );
    expect(placeOrderV2).not.toHaveBeenCalled();
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['ordersV2'] }));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['creditsWallet'] });
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: /tu pedido/i })).not.toBeInTheDocument(),
    );
  });

  it('keeps the normal new-order flow (PickupTimePicker + placeOrderV2) when there is no modifiable order for the day', async () => {
    vi.mocked(getOrdersV2).mockResolvedValue([]);
    vi.mocked(placeOrderV2).mockResolvedValueOnce({
      id: 950,
      fecha: TODAY_ISO,
      pickupAt: '2026-06-01T18:00:00Z',
      estado: 'PENDIENTE',
      creditTotal: 2,
      notas: null,
      items: [],
      cancellable: true,
    });
    renderPage();

    await addDishToCart();
    await openReview();

    expect(screen.getByText('¿A qué hora lo retirás?')).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: /^retiro /i }));

    await waitFor(() => expect(placeOrderV2).toHaveBeenCalled());
    expect(addOrderItemsV2).not.toHaveBeenCalled();
  });

  it('keeps the normal new-order flow for a CONFIRMADO (locked) order of the day', async () => {
    vi.mocked(getOrdersV2).mockResolvedValue([
      orderFor({ estado: 'CONFIRMADO', cancellable: false }),
    ]);
    vi.mocked(placeOrderV2).mockResolvedValueOnce({
      id: 951,
      fecha: TODAY_ISO,
      pickupAt: '2026-06-01T18:00:00Z',
      estado: 'PENDIENTE',
      creditTotal: 2,
      notas: null,
      items: [],
      cancellable: true,
    });
    renderPage();

    await addDishToCart();
    await openReview();

    expect(screen.getByText('¿A qué hora lo retirás?')).toBeInTheDocument();
    expect(screen.queryByText(/se agrega a tu pedido/i)).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: /^retiro /i }));

    await waitFor(() => expect(placeOrderV2).toHaveBeenCalled());
    expect(addOrderItemsV2).not.toHaveBeenCalled();
  });

  it('surfaces insufficient balance from addOrderItemsV2 with the same UX as placing a new order', async () => {
    vi.mocked(getOrdersV2).mockResolvedValue([orderFor()]);
    vi.mocked(addOrderItemsV2).mockRejectedValueOnce(new InsufficientCreditsError());
    renderPage();

    await addDishToCart();
    await openReview();
    fireEvent.click(await screen.findByRole('button', { name: /^agregar a mi pedido$/i }));

    expect(
      await screen.findByText(/no te alcanzan los almuerzos disponibles/i),
    ).toBeInTheDocument();
  });

  it('shows a fallback message and falls back to normal new-order mode when the order stopped being modifiable', async () => {
    // El refetch de `ordersV2` (2do llamado, disparado por la invalidación
    // tras el error) se controla a mano para poder afirmar el estado
    // intermedio (mensaje visible, todavía en modo "agregar") antes de que
    // llegue, y el estado final (mensaje obsoleto limpio) después.
    let call = 0;
    let resolveRefetch: (orders: OrderV2[]) => void = () => {};
    vi.mocked(getOrdersV2).mockImplementation(() => {
      call += 1;
      if (call === 1) return Promise.resolve([orderFor()]);
      return new Promise((resolve) => {
        resolveRefetch = resolve;
      });
    });
    vi.mocked(addOrderItemsV2).mockRejectedValueOnce(new OrderNotModifiableError());
    renderPage();

    await addDishToCart();
    await openReview();
    fireEvent.click(await screen.findByRole('button', { name: /^agregar a mi pedido$/i }));

    expect(
      await screen.findByText(/tu pedido ya no se puede modificar; armá uno nuevo\./i),
    ).toBeInTheDocument();
    // Todavía en modo "agregar a mi pedido": el refetch no llegó.
    expect(screen.queryByText('¿A qué hora lo retirás?')).not.toBeInTheDocument();

    // El refetch de `ordersV2` ya no trae el pedido modificable: la hoja
    // vuelve a modo "pedido nuevo" (picker de horario, sin la línea de "se
    // agrega a tu pedido").
    resolveRefetch([]);
    await waitFor(() => expect(screen.getByText('¿A qué hora lo retirás?')).toBeInTheDocument());
    // Corrección de revisión: una vez en modo "pedido nuevo", el mensaje de
    // error del modo anterior ("armá uno nuevo") queda obsoleto y no debe
    // seguir mostrándose.
    expect(
      screen.queryByText(/tu pedido ya no se puede modificar; armá uno nuevo\./i),
    ).not.toBeInTheDocument();
  });
});

describe('B2cOrderPage — removing a dish with confirmation (F16)', () => {
  const TODAY = '2026-06-01T09:00:00';
  const TODAY_ISO = '2026-06-01';

  function orderFor(overrides: Partial<OrderV2> = {}): OrderV2 {
    return {
      id: 900,
      fecha: TODAY_ISO,
      pickupAt: `${TODAY_ISO}T15:00:00Z`,
      estado: 'PENDIENTE',
      creditTotal: 2,
      notas: null,
      items: [
        {
          id: 1,
          dishId: 20,
          dishNombre: 'Ensalada',
          dishCategoria: 'Básico',
          sideId: null,
          sideNombre: null,
          creditCost: 1,
          notas: null,
        },
        {
          id: 2,
          dishId: 21,
          dishNombre: 'Tarta',
          dishCategoria: 'Básico',
          sideId: null,
          sideNombre: null,
          creditCost: 1,
          notas: null,
        },
      ],
      cancellable: true,
      ...overrides,
    };
  }

  beforeEach(() => {
    vi.setSystemTime(new Date(TODAY));
    useAuthStore.setState({ accessToken: 'token', user: baseUser, bootstrapping: false });
    vi.mocked(getMenuSections).mockResolvedValue([{ id: 1, nombre: 'Carnes', ordenDisplay: 1 }]);
    vi.mocked(getDisabledDates).mockResolvedValue([]);
    vi.mocked(getAvailableDishes).mockResolvedValue([dish]);
    vi.mocked(getPickupSlots).mockResolvedValue(['2026-06-01T18:00:00Z']);
    vi.mocked(getDishPreference).mockResolvedValue(null);
    vi.mocked(getOrdersV2).mockResolvedValue([orderFor()]);
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
    vi.useRealTimers();
  });

  it('opens the confirmation modal from the "×" and removes the item, invalidating ordersV2 and creditsWallet', async () => {
    vi.mocked(removeOrderItemV2).mockResolvedValueOnce({
      ...orderFor(),
      creditTotal: 1,
      items: [orderFor().items[1]],
    });
    const { queryClient } = renderPage();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await screen.findByTestId('selected-day-orders');
    fireEvent.click(await screen.findByRole('button', { name: /quitar ensalada/i }));

    expect(await screen.findByText('¿Quitar Ensalada de tu pedido?')).toBeInTheDocument();
    expect(screen.getByText(/vuelve 1 almuerzo a tu saldo/i)).toBeInTheDocument();
    expect(screen.queryByText(/se cancela el pedido/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^sí, quitar$/i }));

    await waitFor(() => expect(removeOrderItemV2).toHaveBeenCalledWith(900, 1));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['ordersV2'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['creditsWallet'] });
    await waitFor(() =>
      expect(screen.queryByText('¿Quitar Ensalada de tu pedido?')).not.toBeInTheDocument(),
    );
  });

  it('warns that the order will be cancelled when removing the only dish', async () => {
    vi.mocked(getOrdersV2).mockResolvedValue([
      orderFor({ creditTotal: 1, items: [orderFor().items[0]] }),
    ]);
    renderPage();

    await screen.findByTestId('selected-day-orders');
    fireEvent.click(await screen.findByRole('button', { name: /quitar ensalada/i }));

    expect(await screen.findByText(/es el único plato: se cancela el pedido\./i)).toBeInTheDocument();
  });

  it('shows no "×" for a non-modifiable order', async () => {
    vi.mocked(getOrdersV2).mockResolvedValue([orderFor({ cancellable: false })]);
    renderPage();

    await screen.findByTestId('selected-day-orders');
    expect(screen.queryByRole('button', { name: /quitar ensalada/i })).not.toBeInTheDocument();
  });

  it('keeps the modal open while the removal is pending', async () => {
    let resolveRemove: (order: OrderV2) => void = () => {};
    vi.mocked(removeOrderItemV2).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRemove = resolve;
      }),
    );
    renderPage();

    await screen.findByTestId('selected-day-orders');
    fireEvent.click(await screen.findByRole('button', { name: /quitar ensalada/i }));
    fireEvent.click(await screen.findByRole('button', { name: /^sí, quitar$/i }));

    expect(await screen.findByRole('button', { name: /quitando…/i })).toBeDisabled();
    expect(screen.getByText('¿Quitar Ensalada de tu pedido?')).toBeInTheDocument();

    resolveRemove({ ...orderFor(), creditTotal: 1, items: [orderFor().items[1]] });
    await waitFor(() =>
      expect(screen.queryByText('¿Quitar Ensalada de tu pedido?')).not.toBeInTheDocument(),
    );
  });
});
