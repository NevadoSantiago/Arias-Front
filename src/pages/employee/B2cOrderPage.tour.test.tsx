import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { B2cOrderPage } from './B2cOrderPage';
import { useAuthStore, type AuthUser } from '@/features/auth/store/authStore';
import { useCartStore } from '@/features/orders/store/cartStore';
import { TourContext, type TourPageControls } from '@/features/tour/TourContext';
import {
  getAvailableDishes,
  getDisabledDates,
  getDishPreference,
  getMenuSections,
  getOrdersV2,
  getPickupSlots,
  getRestaurantConfig,
} from '@/features/orders/services/ordersApi';
import { getPacks, getWallet } from '@/features/credits/services/creditsApi';
import type { OrderV2 } from '@/features/orders/services/ordersApi';
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
  };
});
vi.mock('@/features/credits/services/creditsApi', () => ({ getWallet: vi.fn(), getPacks: vi.fn() }));

const user: AuthUser = {
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

const plain: Dish = {
  id: 10,
  nombre: 'Tarta de verdura',
  descripcion: '',
  fotoUrl: null,
  category: { id: 1, nombre: 'Básico', parentId: null, creditCost: 1 },
  menuSection: { id: 1, nombre: 'Carnes', ordenDisplay: 1 },
  sideType: null,
  allowedSides: [],
  stockActual: 5,
  especial: false,
};
const withSide: Dish = {
  ...plain,
  id: 11,
  nombre: 'Milanesa napolitana',
  sideType: 'GUARNICION',
  allowedSides: [{ id: 1, nombre: 'Papas fritas', tipo: 'GUARNICION', enabled: true }],
};

function renderPage() {
  let controls: TourPageControls | null = null;
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <TourContext.Provider value={{ active: true, registerPageControls: (c) => (controls = c), canReplay: false, replay: () => {} }}>
          <B2cOrderPage />
        </TourContext.Provider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { controls: () => controls };
}

describe('B2cOrderPage — onboarding tour hooks', () => {
  beforeEach(() => {
    useAuthStore.setState({ accessToken: 'token', user, bootstrapping: false });
    vi.mocked(getMenuSections).mockResolvedValue([{ id: 1, nombre: 'Carnes', ordenDisplay: 1 }]);
    vi.mocked(getDisabledDates).mockResolvedValue([]);
    vi.mocked(getAvailableDishes).mockResolvedValue([plain, withSide]);
    vi.mocked(getPickupSlots).mockResolvedValue(['2026-05-21T15:00:00Z']);
    vi.mocked(getDishPreference).mockResolvedValue(null);
    vi.mocked(getOrdersV2).mockResolvedValue([]);
    vi.mocked(getRestaurantConfig).mockResolvedValue({
      horaCorte: '10:00',
      pickupWindowStart: '11:00',
      pickupWindowEnd: '23:00',
    });
    vi.mocked(getWallet).mockResolvedValue({ available: 1, committed: 0, expiresAt: null });
    vi.mocked(getPacks).mockResolvedValue([]);
  });

  afterEach(() => {
    useCartStore.getState().reset();
    useAuthStore.setState({ accessToken: null, user: null, bootstrapping: true });
    vi.clearAllMocks();
  });

  it('marks the first in-stock dish with a side as the tour dish', async () => {
    renderPage();

    const marked = await screen.findByRole('button', { name: /milanesa napolitana/i });
    expect(marked).toHaveAttribute('data-tour', 'dish');
    expect(marked).toHaveAttribute('data-tour-has-side', 'true');
    expect(screen.getByRole('button', { name: /tarta de verdura/i })).not.toHaveAttribute('data-tour');
  });

  it('marks nothing when no dish can be ordered, so the tour closes on its own', async () => {
    vi.mocked(getAvailableDishes).mockResolvedValue([{ ...plain, stockActual: 0 }]);
    renderPage();

    await screen.findByRole('button', { name: /tarta de verdura/i });
    expect(document.querySelector('[data-tour="dish"]')).toBeNull();
  });

  it('lets the tour close the sheets and empty the cart it built', async () => {
    const { controls } = renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /milanesa napolitana/i }));
    fireEvent.click(await screen.findByRole('radio', { name: /papas fritas/i }));
    fireEvent.click(screen.getByRole('button', { name: /agregar al pedido/i }));
    fireEvent.click(await screen.findByRole('button', { name: /ver pedido/i }));
    await screen.findByRole('dialog', { name: /tu pedido/i });

    act(() => controls()?.resetOrderUi({ clearCart: true }));

    expect(screen.queryByRole('dialog', { name: /tu pedido/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /ver pedido/i })).not.toBeInTheDocument();
    expect(screen.getByText(/tocá un plato para armar tu pedido/i)).toBeInTheDocument();
  });

  it('removes only the dish the tour added and keeps what the customer already had', async () => {
    const { controls } = renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /milanesa napolitana/i }));
    fireEvent.click(await screen.findByRole('radio', { name: /papas fritas/i }));
    fireEvent.click(screen.getByRole('button', { name: /agregar al pedido/i }));
    await screen.findByRole('button', { name: /ver pedido/i });
    // El día elegido solo se conoce una vez armado el carrito: ahí se suma la línea que ya era del cliente.
    const [date] = Object.keys(useCartStore.getState().byDate);
    act(() =>
      useCartStore.getState().addLine(date, {
        localId: 'customer-line',
        dish: plain,
        sideId: null,
        sideNombre: null,
        notas: null,
      }),
    );
    expect(useCartStore.getState().byDate[date]).toHaveLength(2);

    act(() => controls()?.resetOrderUi({ clearCart: true }));

    expect(useCartStore.getState().byDate[date].map((l) => l.localId)).toEqual(['customer-line']);
  });

  it('empties the day when the line it remembers is no longer in the cart', async () => {
    const { controls } = renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /milanesa napolitana/i }));
    fireEvent.click(await screen.findByRole('radio', { name: /papas fritas/i }));
    fireEvent.click(screen.getByRole('button', { name: /agregar al pedido/i }));
    await screen.findByRole('button', { name: /ver pedido/i });
    const [date] = Object.keys(useCartStore.getState().byDate);
    const tourLine = useCartStore.getState().byDate[date][0];
    act(() => {
      useCartStore.getState().removeLine(date, tourLine.localId);
      useCartStore.getState().addLine(date, { ...tourLine, localId: 'other' });
    });

    act(() => controls()?.resetOrderUi({ clearCart: true }));

    expect(useCartStore.getState().byDate[date] ?? []).toHaveLength(0);
  });
});

describe('B2cOrderPage — ensureOrderableDay (tour)', () => {
  const TODAY = '2026-09-30'; // miércoles
  const TOMORROW = '2026-10-01';
  const slots = ['2026-10-01T15:00:00Z'];
  const order = (fecha: string) => ({ id: 1, fecha, estado: 'CONFIRMADO' }) as unknown as OrderV2;

  beforeEach(() => {
    // Solo el reloj: el resto de los temporizadores sigue real para que react-query y waitFor anden.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(`${TODAY}T10:00:00`));
    useAuthStore.setState({ accessToken: 'token', user, bootstrapping: false });
    vi.mocked(getMenuSections).mockResolvedValue([{ id: 1, nombre: 'Carnes', ordenDisplay: 1 }]);
    vi.mocked(getDisabledDates).mockResolvedValue([]);
    vi.mocked(getAvailableDishes).mockResolvedValue([plain, withSide]);
    vi.mocked(getPickupSlots).mockImplementation(async (fecha) => (fecha === TODAY ? [] : slots));
    vi.mocked(getDishPreference).mockResolvedValue(null);
    vi.mocked(getOrdersV2).mockResolvedValue([]);
    vi.mocked(getRestaurantConfig).mockResolvedValue({
      horaCorte: '10:00',
      pickupWindowStart: '11:00',
      pickupWindowEnd: '23:00',
    });
    vi.mocked(getWallet).mockResolvedValue({ available: 1, committed: 0, expiresAt: null });
    vi.mocked(getPacks).mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
    useCartStore.getState().reset();
    useAuthStore.setState({ accessToken: null, user: null, bootstrapping: true });
    vi.clearAllMocks();
  });

  async function ensure(controls: () => TourPageControls | null) {
    await waitFor(() => expect(controls()).not.toBeNull());
    let result: { moved: string | null; orderable: boolean } | undefined;
    await act(async () => {
      result = await controls()!.ensureOrderableDay();
    });
    return result;
  }

  it('moves to the first selectable day with slots and dishes when today has no slots', async () => {
    const { controls } = renderPage();

    expect(await ensure(controls)).toEqual({ moved: TOMORROW, orderable: true });

    expect(getPickupSlots).toHaveBeenCalledWith(TOMORROW);
    expect(await screen.findByRole('button', { name: /milanesa napolitana/i })).toHaveAttribute('data-tour', 'dish');
  });

  it('stays on the current day when it can already be ordered', async () => {
    vi.mocked(getPickupSlots).mockResolvedValue(slots);
    const { controls } = renderPage();

    expect(await ensure(controls)).toEqual({ moved: null, orderable: true });
  });

  it('skips closed days, days with an order already and days without a pickable dish', async () => {
    vi.mocked(getDisabledDates).mockResolvedValue([{ fecha: TOMORROW }] as never);
    vi.mocked(getOrdersV2).mockResolvedValue([order('2026-10-02')]);
    vi.mocked(getAvailableDishes).mockImplementation(async (fecha) =>
      fecha === '2026-10-05' ? [] : [plain, withSide],
    );
    const { controls } = renderPage();

    expect(await ensure(controls)).toEqual({ moved: '2026-10-06', orderable: true });
  });

  it('treats a day whose lookup fails as not orderable', async () => {
    vi.mocked(getPickupSlots).mockImplementation(async (fecha) => {
      if (fecha === TODAY) return [];
      if (fecha === TOMORROW) throw new Error('boom');
      return slots;
    });
    const { controls } = renderPage();

    expect(await ensure(controls)).toEqual({ moved: '2026-10-02', orderable: true });
  });

  it('reports orderable false, without moving, when no selectable day works', async () => {
    vi.mocked(getPickupSlots).mockResolvedValue([]);
    const { controls } = renderPage();

    expect(await ensure(controls)).toEqual({ moved: null, orderable: false });
  });
});
