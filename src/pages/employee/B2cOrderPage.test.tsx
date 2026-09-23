import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { B2cOrderPage } from './B2cOrderPage';
import { useAuthStore, type AuthUser } from '@/features/auth/store/authStore';
import {
  getAvailableDishes,
  getDisabledDates,
  getDishPreference,
  getMenuSections,
  getPickupSlots,
  InsufficientCreditsError,
  placeOrderV2,
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
    getPickupSlots: vi.fn(),
    placeOrderV2: vi.fn(),
  };
});

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

/** El horario exacto que muestra el botón depende del timezone del entorno
 * (`toLocaleTimeString`) — lo ubicamos por el `role="group"` del selector,
 * nunca por el texto formateado. */
async function clickPickupSlot() {
  const group = await screen.findByRole('group', { name: /horario de retiro/i });
  fireEvent.click(within(group).getByRole('button'));
}

describe('B2cOrderPage — credits cart flow (B2C, no company)', () => {
  beforeEach(() => {
    useAuthStore.setState({ accessToken: 'token', user: baseUser, bootstrapping: false });
    vi.mocked(getMenuSections).mockResolvedValue([{ id: 1, nombre: 'Carnes', ordenDisplay: 1 }]);
    vi.mocked(getDisabledDates).mockResolvedValue([]);
    vi.mocked(getAvailableDishes).mockResolvedValue([dish]);
    vi.mocked(getPickupSlots).mockResolvedValue(['2026-05-21T15:00:00Z']);
    vi.mocked(getDishPreference).mockResolvedValue(null);
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

  it('keeps the confirm button disabled until a pickup slot is chosen', async () => {
    renderPage();

    await addDishToCart();

    const confirmButton = await screen.findByRole('button', { name: /^confirmar pedido$/i });
    expect(confirmButton).toBeDisabled();

    await clickPickupSlot();

    expect(confirmButton).not.toBeDisabled();
  });

  it('confirms the order against POST /api/v2/orders with the exact cart items and chosen pickup slot', async () => {
    vi.mocked(placeOrderV2).mockResolvedValueOnce({
      id: 99,
      fecha: '2026-05-21',
      pickupAt: '2026-05-21T15:00:00Z',
      estado: 'PENDIENTE',
      creditTotal: 2,
      notas: null,
      items: [],
    });
    renderPage();

    await addDishToCart();
    await clickPickupSlot();
    fireEvent.click(screen.getByRole('button', { name: /^confirmar pedido$/i }));

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
    await clickPickupSlot();
    fireEvent.click(screen.getByRole('button', { name: /^confirmar pedido$/i }));

    expect(
      await screen.findByText(/no te alcanzan los almuerzos disponibles/i),
    ).toBeInTheDocument();
    expect(screen.queryByText('¡Pedido confirmado!')).not.toBeInTheDocument();
  });
});
