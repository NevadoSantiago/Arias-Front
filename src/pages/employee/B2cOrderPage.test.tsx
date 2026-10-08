import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { B2cOrderPage } from './B2cOrderPage';
import { useAuthStore, type AuthUser } from '@/features/auth/store/authStore';
import { useCartStore } from '@/features/orders/store/cartStore';
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
  BalanceCoversOrderError,
  InsufficientCreditsError,
  OrderNotModifiableError,
  placeOrderV2,
  removeOrderItemV2,
  startDirectCheckoutV2,
  type OrderV2,
} from '@/features/orders/services/ordersApi';
import { getPacks, getWallet } from '@/features/credits/services/creditsApi';
import type { Dish } from '@/features/orders/types';
import { mockMatchMedia } from '@/test/matchMedia';

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

function renderPage(route = '/') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
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

/** Arma un carrito de hoy sin pasar por la hoja del plato (sirve cuando el día ya no tiene horarios). */
function seedCartForToday() {
  useCartStore.getState().addLine(toIso(new Date()), {
    localId: 'seed-1',
    dish,
    sideId: null,
    sideNombre: null,
    notas: null,
  });
}

// El carrito es un store global (F24): cada test arranca vacío.
afterEach(() => useCartStore.getState().reset());

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

  it('shows no daily illustration on phones (it is desktop only)', async () => {
    renderPage();

    await screen.findByRole('button', { name: /milanesa napolitana/i });
    expect(screen.queryByTestId('daily-illustration')).not.toBeInTheDocument();
  });

  /**
   * F4: el detalle de plato pasa a ser una hoja (`DishSheet`) y el carrito
   * (con el horario de retiro y el botón de confirmar) vive en la hoja de
   * revisión (`OrderReviewSheet`), que se abre con "Ver pedido" en la barra
   * inferior — ya no está siempre visible bajo el menú.
   */
  it('adds a dish to the cart and shows its cost in "almuerzos" only in the balance box, never "créditos"', async () => {
    renderPage();

    await addDishToCart();
    await openReview();

    // El costo solo aparece en "Este pedido usa" del cálculo de saldo
    // (display-only): ni la línea del carrito ni un total lo repiten.
    expect(await screen.findAllByText('2 almuerzos')).toHaveLength(1);
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

  it('keeps the confirm button disabled and explains why when a cart already built has no pickup slots left', async () => {
    seedCartForToday();
    vi.mocked(getPickupSlots).mockResolvedValue([]);
    renderPage();

    await openReview();

    expect(await screen.findByText(/no quedan horarios de retiro para este día. elegí otro día./i)).toBeInTheDocument();
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
      items: [
        { id: 1, dishId: 10, dishNombre: 'Milanesa napolitana', dishCategoria: 'Básico', sideId: null, sideNombre: null, creditCost: 2, notas: null },
      ],
      cancellable: true,
      modifiable: true,
      pickupTimeChangeable: true,
      paidWithMercadoPago: false,
      creditsFromBalance: 0,
    });
    renderPage();

    await addDishToCart();
    await openReview();
    fireEvent.click(await screen.findByRole('button', { name: /^retiro /i }));

    expect(await screen.findByText('¡Pedido confirmado!')).toBeInTheDocument();
    // F20: la confirmación es la comanda del pedido, con el nombre con el que lo llaman.
    expect(screen.getByText('Comanda Nº 0099')).toBeInTheDocument();
    expect(screen.getByText('Te vamos a llamar como')).toBeInTheDocument();
    expect(screen.getByText('Sofi')).toBeInTheDocument();
    expect(screen.queryByText(/Reservaste/)).not.toBeInTheDocument();
    expect(screen.queryByText('Te quedan 10 almuerzos')).not.toBeInTheDocument();
    expect(placeOrderV2).toHaveBeenCalledWith({
      items: [{ dishId: 10, sideId: null, notas: null }],
      pickupAt: '2026-05-21T15:00:00Z',
      notas: null,
    });
  });

  /**
   * F18: en un pedido NUEVO, el saldo insuficiente reportado por el backend
   * ya no solo avisa — abre la hoja "Pagá este pedido con Mercado Pago" (el
   * servidor sigue decidiendo: se intenta `placeOrderV2` y se reacciona a su
   * `InsufficientCreditsError`). Cambio de comportamiento intencional sobre
   * el aviso inline de antes; el aviso inline se conserva en modo "agregar
   * al pedido" (ver el describe de F16 más abajo).
   */
  it('surfaces insufficient balance from the backend by opening the pay-direct sheet, without calculating it on the client', async () => {
    vi.mocked(placeOrderV2).mockRejectedValueOnce(new InsufficientCreditsError());
    vi.mocked(getPacks).mockResolvedValue([]);
    renderPage();

    await addDishToCart();
    await openReview();
    fireEvent.click(await screen.findByRole('button', { name: /^retiro /i }));

    expect(await screen.findByText('Pagá este pedido con Mercado Pago')).toBeInTheDocument();
    expect(screen.queryByText('¡Pedido confirmado!')).not.toBeInTheDocument();
  });

  it('shows the pay-direct sheet total and pays via startDirectCheckoutV2 with the cart payload, then redirects and clears the cart', async () => {
    // Autocontenido: el stub se restaura en el `finally` de este mismo test.
    const originalLocationDescriptor = Object.getOwnPropertyDescriptor(window, 'location')!;
    Object.defineProperty(window, 'location', { writable: true, value: { href: '' } });
    try {
      vi.mocked(placeOrderV2).mockRejectedValueOnce(new InsufficientCreditsError());
      vi.mocked(getPacks).mockResolvedValue([
        { id: 1, code: 'DAY', packType: 'INDIVIDUAL', nombre: 'Sueltos', creditAmount: 1, priceCents: 150000, discountPercent: 0, ordenDisplay: 1, enabled: true },
      ]);
      vi.mocked(startDirectCheckoutV2).mockResolvedValueOnce({
        orderId: 42,
        purchaseId: 'p-1',
        initPoint: 'https://mp.example/checkout/p-1',
      });
      renderPage();

      await addDishToCart();
      await openReview();
      fireEvent.click(await screen.findByRole('button', { name: /^retiro /i }));

      await screen.findByText('Pagá este pedido con Mercado Pago');
      // 2 almuerzos (categoría "Básico", creditCost 2) × $1.500,00 = $3.000,00.
      fireEvent.click(await screen.findByRole('button', { name: /pagar \$\s?3\.000,00 con mercado pago/i }));

      await waitFor(() =>
        expect(startDirectCheckoutV2).toHaveBeenCalledWith({
          items: [{ dishId: 10, sideId: null, notas: null }],
          pickupAt: '2026-05-21T15:00:00Z',
          notas: null,
        }),
      );
      await vi.waitFor(() => expect(window.location.href).toBe('https://mp.example/checkout/p-1'));

      // El carrito del día se vació antes de redirigir — la barra inferior
      // vuelve al estado vacío.
      expect(await screen.findByText('Tocá un plato para armar tu pedido.')).toBeInTheDocument();
    } finally {
      Object.defineProperty(window, 'location', originalLocationDescriptor);
    }
  });

  /**
   * F23 (D5, backend B13): con saldo parcial, el pago directo usa los
   * almuerzos disponibles y Mercado Pago cobra SOLO el resto. Lo que se
   * muestra es informativo; el servidor decide y cobra.
   */
  it('offers to pay only what is missing when the balance covers part of the order', async () => {
    vi.mocked(getWallet).mockResolvedValue({ available: 1, committed: 0, expiresAt: null });
    vi.mocked(placeOrderV2).mockRejectedValueOnce(new InsufficientCreditsError());
    vi.mocked(getPacks).mockResolvedValue([
      { id: 1, code: 'DAY', packType: 'INDIVIDUAL', nombre: 'Sueltos', creditAmount: 1, priceCents: 150000, discountPercent: 0, ordenDisplay: 1, enabled: true },
    ]);
    renderPage();

    await addDishToCart();
    await openReview();
    fireEvent.click(await screen.findByRole('button', { name: /^retiro /i }));

    expect(await screen.findByText('Pagá lo que falta con Mercado Pago')).toBeInTheDocument();
    // El pedido usa 2 almuerzos y hay 1 disponible: Mercado Pago cobra 1 × $1.500,00.
    expect(await screen.findByRole('button', { name: /pagar \$\s?1\.500,00 con mercado pago/i })).toBeInTheDocument();
  });

  it('goes back to the review with a clear message when the server says the balance now covers the order (409)', async () => {
    vi.mocked(getWallet).mockResolvedValue({ available: 1, committed: 0, expiresAt: null });
    vi.mocked(placeOrderV2).mockRejectedValueOnce(new InsufficientCreditsError());
    vi.mocked(getPacks).mockResolvedValue([
      { id: 1, code: 'DAY', packType: 'INDIVIDUAL', nombre: 'Sueltos', creditAmount: 1, priceCents: 150000, discountPercent: 0, ordenDisplay: 1, enabled: true },
    ]);
    vi.mocked(startDirectCheckoutV2).mockRejectedValueOnce(new BalanceCoversOrderError());
    const { queryClient } = renderPage();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await addDishToCart();
    await openReview();
    fireEvent.click(await screen.findByRole('button', { name: /^retiro /i }));
    fireEvent.click(await screen.findByRole('button', { name: /pagar \$\s?1\.500,00 con mercado pago/i }));

    // Nunca se cobra ni se redirige: vuelve la revisión con el motivo y el saldo se vuelve a pedir.
    expect(await screen.findByText(/tus almuerzos disponibles ahora alcanzan para este pedido/i)).toBeInTheDocument();
    expect(screen.queryByText('Pagá lo que falta con Mercado Pago')).not.toBeInTheDocument();
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['creditsWallet'] });
    expect(placeOrderV2).toHaveBeenCalledTimes(1);
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
      modifiable: true,
      pickupTimeChangeable: true,
      paidWithMercadoPago: false,
      creditsFromBalance: 0,
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
      modifiable: true,
      pickupTimeChangeable: true,
      paidWithMercadoPago: false,
      creditsFromBalance: 0,
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

  /**
   * F18, decisión del usuario (2026-09-28): un pedido `PENDIENTE_PAGO` se
   * trata como un pedido activo en el tilde del día — el pedido ya existe y
   * reserva stock, aunque el pago no esté confirmado todavía. Sin cambio de
   * código: `orderedDates` ya filtraba solo por `estado !== 'CANCELADO'`.
   */
  it('shows a check on a day with a PENDIENTE_PAGO order (treated as active)', async () => {
    const [activeDate] = nextWeekMondayAndTuesday();
    vi.mocked(getOrdersV2).mockResolvedValue([
      {
        id: 1,
        fecha: activeDate,
        pickupAt: `${activeDate}T15:00:00Z`,
        estado: 'PENDIENTE_PAGO',
        creditTotal: 2,
        notas: null,
        items: [],
        cancellable: true,
        modifiable: true,
        pickupTimeChangeable: true,
        paidWithMercadoPago: false,
        creditsFromBalance: 0,
      },
    ]);

    renderPage();

    const activeDayButton = (
      await screen.findByText(String(Number(activeDate.split('-')[2])))
    ).closest('button');
    expect(activeDayButton?.querySelector('svg')).toBeTruthy();
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

describe('B2cOrderPage — opened from "Agregar platos" of a comanda (F20)', () => {
  beforeEach(() => {
    useAuthStore.setState({ accessToken: 'token', user: baseUser, bootstrapping: false });
    vi.mocked(getMenuSections).mockResolvedValue([{ id: 1, nombre: 'Carnes', ordenDisplay: 1 }]);
    vi.mocked(getDisabledDates).mockResolvedValue([]);
    vi.mocked(getAvailableDishes).mockResolvedValue([dish]);
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

  it('starts on the day given by ?fecha instead of today', async () => {
    const [futureDate] = nextWeekMondayAndTuesday();
    vi.mocked(getPickupSlots).mockResolvedValue([`${futureDate}T15:00:00Z`]);

    renderPage(`/orders/today?fecha=${futureDate}`);

    await waitFor(() => expect(getAvailableDishes).toHaveBeenCalledWith(futureDate));
    expect(getAvailableDishes).not.toHaveBeenCalledWith(toIso(new Date()));
  });

  it('ignores a ?fecha that is not a date and keeps today', async () => {
    vi.mocked(getPickupSlots).mockResolvedValue(['2026-05-21T15:00:00Z']);

    renderPage('/orders/today?fecha=abc');

    await waitFor(() => expect(getAvailableDishes).toHaveBeenCalledWith(toIso(new Date())));
    expect(getAvailableDishes).toHaveBeenCalledTimes(1);
  });

  it('preselects the pickup time of ?hora in the review sheet (the "Sumarlo" jump)', async () => {
    const [futureDate] = nextWeekMondayAndTuesday();
    const first = `${futureDate}T15:00:00Z`;
    const wanted = `${futureDate}T18:00:00Z`;
    vi.mocked(getPickupSlots).mockResolvedValue([first, wanted]);

    renderPage(`/orders/today?fecha=${futureDate}&hora=${encodeURIComponent(wanted)}`);
    await addDishToCart();
    await openReview();

    const hour = (await screen.findByLabelText('Hora de retiro')) as HTMLSelectElement;
    expect(hour.value).toBe(String(new Date(wanted).getHours()));
    expect(screen.getByRole('radio', { name: /elegir horario/i })).toHaveAttribute('aria-checked', 'true');
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
      modifiable: true,
      pickupTimeChangeable: true,
      paidWithMercadoPago: false,
      creditsFromBalance: 0,
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
      modifiable: true,
      pickupTimeChangeable: true,
      paidWithMercadoPago: false,
      creditsFromBalance: 0,
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

describe('B2cOrderPage — same-day rule: add to the order at the same time, new order otherwise (F16, F21)', () => {
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
      modifiable: true,
      pickupTimeChangeable: true,
      paidWithMercadoPago: false,
      creditsFromBalance: 0,
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

  it('adds the cart to the modifiable order when the chosen time equals its pickup time (addOrderItemsV2 with the order id)', async () => {
    vi.mocked(getPickupSlots).mockResolvedValue([`${TODAY_ISO}T15:00:00Z`, `${TODAY_ISO}T18:00:00Z`]);
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
    expect(screen.getByText('¿A qué hora lo retirás?')).toBeInTheDocument();

    fireEvent.click(await screen.findByRole('button', { name: /^sumar a mi pedido de las \d{2}:\d{2}$/i }));

    await waitFor(() =>
      expect(addOrderItemsV2).toHaveBeenCalledWith(900, [{ dishId: 10, sideId: null, notas: null }]),
    );
    expect(placeOrderV2).not.toHaveBeenCalled();
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['ordersV2'] }));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['creditsWallet'] });
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: /tu pedido/i })).not.toBeInTheDocument(),
    );
    // F20: sumar platos también termina en la comanda de ese pedido, con lo nuevo marcado.
    expect(await screen.findByText('¡Sumado a tu pedido!')).toBeInTheDocument();
    expect(screen.getByText('Comanda Nº 0900')).toBeInTheDocument();
    expect(screen.getAllByText('Nuevo')).toHaveLength(1);
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
      modifiable: true,
      pickupTimeChangeable: true,
      paidWithMercadoPago: false,
      creditsFromBalance: 0,
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
      orderFor({ estado: 'CONFIRMADO', cancellable: false, modifiable: false, pickupTimeChangeable: false }),
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
      modifiable: true,
      pickupTimeChangeable: true,
      paidWithMercadoPago: false,
      creditsFromBalance: 0,
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

  /**
   * F18: el pago directo aplica solo a pedidos NUEVOS. En modo "agregar al
   * pedido" el saldo insuficiente conserva el aviso inline de siempre — no
   * se ofrece "Pagá este pedido con Mercado Pago".
   */
  it('surfaces insufficient balance from addOrderItemsV2 with the same UX as placing a new order (never the pay-direct sheet)', async () => {
    vi.mocked(getPickupSlots).mockResolvedValue([`${TODAY_ISO}T15:00:00Z`]);
    vi.mocked(getOrdersV2).mockResolvedValue([orderFor()]);
    vi.mocked(addOrderItemsV2).mockRejectedValueOnce(new InsufficientCreditsError());
    renderPage();

    await addDishToCart();
    await openReview();
    fireEvent.click(await screen.findByRole('button', { name: /^sumar a mi pedido de las \d{2}:\d{2}$/i }));

    expect(
      await screen.findByText(/no te alcanzan los almuerzos disponibles/i),
    ).toBeInTheDocument();
    expect(screen.queryByText('Pagá este pedido con Mercado Pago')).not.toBeInTheDocument();
    expect(startDirectCheckoutV2).not.toHaveBeenCalled();
  });

  it('shows a fallback message and falls back to normal new-order mode when the order stopped being modifiable', async () => {
    // El refetch de `ordersV2` (2do llamado, disparado por la invalidación
    // tras el error) se controla a mano para poder afirmar el estado
    // intermedio (mensaje visible, todavía en modo "agregar") antes de que
    // llegue, y el estado final (mensaje obsoleto limpio) después.
    vi.mocked(getPickupSlots).mockResolvedValue([`${TODAY_ISO}T15:00:00Z`]);
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
    fireEvent.click(await screen.findByRole('button', { name: /^sumar a mi pedido de las \d{2}:\d{2}$/i }));

    expect(
      await screen.findByText(/tu pedido ya no se puede modificar; armá uno nuevo\./i),
    ).toBeInTheDocument();
    // Todavía en modo "sumar a mi pedido": el refetch no llegó.
    expect(screen.getByText(/se agrega a tu pedido de las/i)).toBeInTheDocument();

    // El refetch de `ordersV2` ya no trae el pedido modificable: la hoja
    // vuelve a modo "pedido nuevo" (picker de horario, sin la línea de "se
    // agrega a tu pedido").
    resolveRefetch([]);
    await waitFor(() =>
      expect(screen.queryByText(/se agrega a tu pedido de las/i)).not.toBeInTheDocument(),
    );
    expect(screen.getByText('¿A qué hora lo retirás?')).toBeInTheDocument();
    // Corrección de revisión: una vez en modo "pedido nuevo", el mensaje de
    // error del modo anterior ("armá uno nuevo") queda obsoleto y no debe
    // seguir mostrándose.
    expect(
      screen.queryByText(/tu pedido ya no se puede modificar; armá uno nuevo\./i),
    ).not.toBeInTheDocument();
  });

  it('keeps the picker visible and creates a NEW order at a different time, leaving the existing one untouched', async () => {
    // El pedido existente es a las 15:00Z; el único horario ofrecido es 18:00Z.
    vi.mocked(getOrdersV2).mockResolvedValue([orderFor()]);
    vi.mocked(placeOrderV2).mockResolvedValueOnce({ ...orderFor(), id: 952, pickupAt: `${TODAY_ISO}T18:00:00Z` });
    renderPage();

    await addDishToCart();
    await openReview();

    expect(screen.getByText('¿A qué hora lo retirás?')).toBeInTheDocument();
    expect(await screen.findByText(/^nuevo pedido a las \d{2}:\d{2}$/i)).toBeInTheDocument();
    expect(screen.getByText(/tu pedido de las \d{2}:\d{2} queda como está/i)).toBeInTheDocument();
    expect(screen.queryByText(/se agrega a tu pedido de las/i)).not.toBeInTheDocument();

    fireEvent.click(await screen.findByRole('button', { name: /^retiro hoy \d{2}:\d{2} hs$/i }));

    await waitFor(() =>
      expect(placeOrderV2).toHaveBeenCalledWith(
        expect.objectContaining({ pickupAt: `${TODAY_ISO}T18:00:00Z` }),
      ),
    );
    expect(addOrderItemsV2).not.toHaveBeenCalled();
  });

  it('creates a new order (never add-items) at the same time as a PENDIENTE_PAGO order of the day', async () => {
    vi.mocked(getPickupSlots).mockResolvedValue([`${TODAY_ISO}T15:00:00Z`]);
    vi.mocked(getOrdersV2).mockResolvedValue([
      orderFor({ estado: 'PENDIENTE_PAGO', modifiable: false, pickupTimeChangeable: false }),
    ]);
    vi.mocked(placeOrderV2).mockResolvedValueOnce({ ...orderFor(), id: 953 });
    renderPage();

    await addDishToCart();
    await openReview();

    expect(await screen.findByText(/espera el pago, así que este va aparte/i)).toBeInTheDocument();
    expect(screen.queryByText(/se agrega a tu pedido de las/i)).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: /^retiro hoy \d{2}:\d{2} hs$/i }));

    await waitFor(() => expect(placeOrderV2).toHaveBeenCalled());
    expect(addOrderItemsV2).not.toHaveBeenCalled();
  });

  // B10: el pedido es cancelable pero el backend dice que no admite agregar
  // platos (p. ej. pagado aparte por Mercado Pago) — se decide por `modifiable`.
  it('decides by modifiable, not cancellable: a cancellable but non-modifiable order at the same time gets a new order', async () => {
    vi.mocked(getPickupSlots).mockResolvedValue([`${TODAY_ISO}T15:00:00Z`]);
    vi.mocked(getOrdersV2).mockResolvedValue([
      orderFor({ cancellable: true, modifiable: false, pickupTimeChangeable: false }),
    ]);
    vi.mocked(placeOrderV2).mockResolvedValueOnce({ ...orderFor(), id: 954 });
    renderPage();

    await addDishToCart();
    await openReview();
    fireEvent.click(await screen.findByRole('button', { name: /^retiro hoy \d{2}:\d{2} hs$/i }));

    await waitFor(() => expect(placeOrderV2).toHaveBeenCalled());
    expect(addOrderItemsV2).not.toHaveBeenCalled();
  });

  it('lets the customer jump to the existing order time with "Sumarlo al pedido de las HH:MM"', async () => {
    vi.mocked(getPickupSlots).mockResolvedValue([`${TODAY_ISO}T15:00:00Z`, `${TODAY_ISO}T18:00:00Z`]);
    vi.mocked(getOrdersV2).mockResolvedValue([orderFor()]);
    vi.mocked(addOrderItemsV2).mockResolvedValueOnce(orderFor());
    renderPage();

    await addDishToCart();
    await openReview();
    // Arranca en el horario del pedido existente (última utilizada): se suma.
    expect(await screen.findByText(/se agrega a tu pedido de las/i)).toBeInTheDocument();

    // Elige a mano el otro horario: pasa a pedido nuevo.
    const later = new Date(`${TODAY_ISO}T18:00:00Z`);
    fireEvent.click(screen.getByRole('radio', { name: /elegir horario/i }));
    fireEvent.change(screen.getByLabelText('Hora de retiro'), { target: { value: String(later.getHours()) } });
    fireEvent.change(screen.getByLabelText('Minutos'), { target: { value: String(later.getMinutes()) } });
    expect(await screen.findByText(/^nuevo pedido a las \d{2}:\d{2}$/i)).toBeInTheDocument();

    // El atajo vuelve al horario del pedido existente: se suma de nuevo.
    fireEvent.click(screen.getByRole('button', { name: /sumarlo al pedido de las \d{2}:\d{2}/i }));
    expect(await screen.findByText(/se agrega a tu pedido de las/i)).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: /^sumar a mi pedido de las \d{2}:\d{2}$/i }));
    await waitFor(() => expect(addOrderItemsV2).toHaveBeenCalledWith(900, expect.any(Array)));
  });

  // F21.1: el salto del atajo es de una sola vez; cerrar la hoja lo descarta y
  // al reabrirla el selector vuelve a la opción automática.
  it('does not re-apply a stale "Sumarlo" jump after the review sheet is closed and reopened', async () => {
    vi.mocked(getPickupSlots).mockResolvedValue([`${TODAY_ISO}T15:00:00Z`, `${TODAY_ISO}T18:00:00Z`]);
    vi.mocked(getOrdersV2).mockResolvedValue([orderFor()]);
    renderPage();

    await addDishToCart();
    await openReview();
    await screen.findByText(/se agrega a tu pedido de las/i);
    const later = new Date(`${TODAY_ISO}T18:00:00Z`);
    fireEvent.click(screen.getByRole('radio', { name: /elegir horario/i }));
    fireEvent.change(screen.getByLabelText('Hora de retiro'), { target: { value: String(later.getHours()) } });
    fireEvent.change(screen.getByLabelText('Minutos'), { target: { value: String(later.getMinutes()) } });
    fireEvent.click(await screen.findByRole('button', { name: /sumarlo al pedido de las \d{2}:\d{2}/i }));
    expect(screen.getByRole('radio', { name: /elegir horario/i })).toHaveAttribute('aria-checked', 'true');

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByText('¿A qué hora lo retirás?')).not.toBeInTheDocument());
    await openReview();

    expect(await screen.findByRole('radio', { name: /última utilizada/i })).toHaveAttribute('aria-checked', 'true');
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
      modifiable: true,
      pickupTimeChangeable: true,
      paidWithMercadoPago: false,
      creditsFromBalance: 0,
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

/**
 * F24: el carrito sobrevive a salir de la pantalla y volver (el store no
 * depende del montaje de la página).
 */
describe('B2cOrderPage — the cart survives navigation (F24)', () => {
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

  it('shows the same items after leaving the page and coming back', async () => {
    const first = renderPage();
    await addDishToCart();
    await openReview();
    expect(await screen.findAllByText('Milanesa napolitana')).not.toHaveLength(0);
    first.unmount();

    renderPage();

    expect(await screen.findByRole('button', { name: /ver pedido/i })).toBeInTheDocument();
    await openReview();
    expect(await screen.findAllByText('2 almuerzos')).not.toHaveLength(0);
    expect(screen.getAllByText('Milanesa napolitana').length).toBeGreaterThan(0);
  });

  it('does not crash when a stored line points to a dish that is no longer in the day menu', async () => {
    const first = renderPage();
    await addDishToCart();
    first.unmount();
    // El menú del día cambió: el plato guardado ya no está.
    vi.mocked(getAvailableDishes).mockResolvedValue([]);

    renderPage();

    await openReview();
    // La línea se sigue mostrando desde su copia; el servidor decide al confirmar.
    expect((await screen.findAllByText('Milanesa napolitana')).length).toBeGreaterThan(0);
  });

  it('empties the day after a successful placement, also for the next visit', async () => {
    vi.mocked(placeOrderV2).mockResolvedValueOnce({
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
    });
    const first = renderPage();
    await addDishToCart();
    await openReview();
    fireEvent.click(await screen.findByRole('button', { name: /^retiro /i }));
    expect(await screen.findByText('¡Pedido confirmado!')).toBeInTheDocument();
    first.unmount();

    renderPage();

    await screen.findByRole('button', { name: /milanesa napolitana/i });
    expect(screen.queryByRole('button', { name: /ver pedido/i })).not.toBeInTheDocument();
  });
});

describe('B2cOrderPage — a day with no pickup slots cannot be ordered', () => {
  const NOTICE = /ya no quedan horarios de retiro para este día/i;

  beforeEach(() => {
    useAuthStore.setState({ accessToken: 'token', user: baseUser, bootstrapping: false });
    vi.mocked(getMenuSections).mockResolvedValue([{ id: 1, nombre: 'Carnes', ordenDisplay: 1 }]);
    vi.mocked(getDisabledDates).mockResolvedValue([]);
    vi.mocked(getAvailableDishes).mockResolvedValue([dish]);
    vi.mocked(getPickupSlots).mockResolvedValue([]);
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

  it('shows the notice, keeps the dishes visible but disabled, and hides the cart bar', async () => {
    renderPage();

    expect(await screen.findByText(NOTICE)).toBeInTheDocument();
    expect(screen.getByText(/elegí otro día para armar tu pedido/i)).toBeInTheDocument();

    const card = screen.getByRole('button', { name: /milanesa napolitana/i });
    expect(card).toBeDisabled();
    expect(card).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(card);
    expect(screen.queryByRole('button', { name: /agregar al pedido/i })).not.toBeInTheDocument();

    expect(screen.queryByRole('button', { name: /ver pedido/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/tocá un plato para armar tu pedido/i)).not.toBeInTheDocument();
  });

  it('does not offer the tour dish target on a day with no slots', async () => {
    const { unmount } = renderPage();
    await screen.findByText(NOTICE);
    expect(document.querySelector('[data-tour="dish"]')).toBeNull();
    unmount();

    vi.mocked(getPickupSlots).mockResolvedValue(['2026-05-21T15:00:00Z']);
    renderPage();
    await screen.findByRole('button', { name: /milanesa napolitana/i });
    expect(document.querySelector('[data-tour="dish"]')).not.toBeNull();
  });

  it('does not flash the notice while the slots are loading', async () => {
    vi.mocked(getPickupSlots).mockReturnValue(new Promise(() => {}));
    renderPage();

    const card = await screen.findByRole('button', { name: /milanesa napolitana/i });
    expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();
    expect(card).not.toBeDisabled();
  });

  it('does not block ordering when the slots fail to load', async () => {
    vi.mocked(getPickupSlots).mockRejectedValue(new Error('boom'));
    renderPage();

    const card = await screen.findByRole('button', { name: /milanesa napolitana/i });
    await waitFor(() => expect(getPickupSlots).toHaveBeenCalled());
    expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();
    expect(card).not.toBeDisabled();
  });

  it('keeps the day unchanged when there are slots', async () => {
    vi.mocked(getPickupSlots).mockResolvedValue(['2026-05-21T15:00:00Z']);
    renderPage();

    const card = await screen.findByRole('button', { name: /milanesa napolitana/i });
    expect(card).not.toBeDisabled();
    expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();
    expect(screen.getByText(/tocá un plato para armar tu pedido/i)).toBeInTheDocument();
  });

  it('keeps the cart bar when the day already has items, and the review explains why it cannot confirm', async () => {
    seedCartForToday();
    renderPage();

    expect(await screen.findByText(NOTICE)).toBeInTheDocument();
    await openReview();
    expect(await screen.findByRole('button', { name: /^confirmar pedido$/i })).toBeDisabled();
  });

  describe('on desktop', () => {
    let media: ReturnType<typeof mockMatchMedia>;
    beforeEach(() => {
      media = mockMatchMedia(true);
    });
    afterEach(() => media.restore());

    it('shows the notice and no "Tu pedido" panel when the cart is empty', async () => {
      renderPage();

      expect(await screen.findByText(NOTICE)).toBeInTheDocument();
      expect(screen.queryByRole('complementary', { name: /tu pedido/i })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /milanesa napolitana/i })).toBeDisabled();
    });

    it('keeps the panel, with the confirm button disabled, when the day already has items', async () => {
      seedCartForToday();
      renderPage();

      expect(await screen.findByText(NOTICE)).toBeInTheDocument();
      const panel = screen.getByRole('complementary', { name: /tu pedido/i });
      expect(within(panel).getByRole('button', { name: /^confirmar pedido$/i })).toBeDisabled();
    });
  });
});
