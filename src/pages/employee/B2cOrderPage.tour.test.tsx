import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
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
        <TourContext.Provider value={{ active: true, registerPageControls: (c) => (controls = c) }}>
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
});
