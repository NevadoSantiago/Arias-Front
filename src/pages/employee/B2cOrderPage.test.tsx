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
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <B2cOrderPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function addDishToCart() {
  fireEvent.click(await screen.findByRole('button', { name: /milanesa napolitana/i }));
  fireEvent.click(await screen.findByRole('button', { name: /agregar al carrito/i }));
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
  });

  afterEach(() => {
    useAuthStore.setState({ accessToken: null, user: null, bootstrapping: true });
    vi.clearAllMocks();
  });

  it('adds a dish to the cart and shows its cost in "almuerzos", never "créditos"', async () => {
    renderPage();

    await addDishToCart();

    // El costo de la línea (2 almuerzos) y el total del carrito (2 almuerzos)
    expect(await screen.findAllByText('2 almuerzos')).toHaveLength(2);
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

    const confirmButton = await screen.findByRole('button', { name: /^retiro /i });
    expect(confirmButton).not.toBeDisabled();
  });

  it('keeps the confirm button disabled when there are no pickup slots for the selected day', async () => {
    vi.mocked(getPickupSlots).mockResolvedValue([]);
    renderPage();

    await addDishToCart();

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
    fireEvent.click(await screen.findByRole('button', { name: /^retiro /i }));

    expect(
      await screen.findByText(/no te alcanzan los almuerzos disponibles/i),
    ).toBeInTheDocument();
    expect(screen.queryByText('¡Pedido confirmado!')).not.toBeInTheDocument();
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
  });

  afterEach(() => {
    useAuthStore.setState({ accessToken: null, user: null, bootstrapping: true });
    vi.clearAllMocks();
  });

  it('shows "Retiro hoy HH:MM hs" for today and switches to "Retiro <día> a las HH:MM" for a future day', async () => {
    const [futureDate] = nextWeekMondayAndTuesday();
    renderPage();

    await addDishToCart();

    expect(
      await screen.findByRole('button', { name: /^retiro hoy \d{2}:\d{2} hs$/i }),
    ).toBeInTheDocument();

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
