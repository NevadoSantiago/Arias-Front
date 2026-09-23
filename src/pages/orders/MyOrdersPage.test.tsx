import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { MyOrdersPage } from './MyOrdersPage';
import { cancelOrderV2, getOrdersV2 } from '@/features/orders/services/ordersApi';
import type { OrderV2 } from '@/features/orders/services/ordersApi';

vi.mock('@/features/orders/services/ordersApi', async () => {
  const actual = await vi.importActual<typeof import('@/features/orders/services/ordersApi')>(
    '@/features/orders/services/ordersApi',
  );
  return {
    ...actual,
    getOrdersV2: vi.fn(),
    cancelOrderV2: vi.fn(),
  };
});

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <MyOrdersPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const cancellableOrder: OrderV2 = {
  id: 123,
  fecha: '2026-09-24',
  pickupAt: '2026-09-24T14:00:00Z',
  estado: 'PENDIENTE',
  creditTotal: 4,
  notas: null,
  items: [
    {
      id: 1,
      dishId: 10,
      dishNombre: 'Milanesa',
      dishCategoria: 'Premium',
      sideId: 5,
      sideNombre: 'Puré',
      creditCost: 2,
      notas: null,
    },
    {
      id: 2,
      dishId: 11,
      dishNombre: 'Ensalada',
      dishCategoria: 'Básico',
      sideId: null,
      sideNombre: null,
      creditCost: 2,
      notas: null,
    },
  ],
  cancellable: true,
};

const nonCancellableOrder: OrderV2 = {
  ...cancellableOrder,
  id: 124,
  estado: 'CONFIRMADO',
  cancellable: false,
};

const cancelledOrder: OrderV2 = {
  ...cancellableOrder,
  id: 125,
  estado: 'CANCELADO',
  cancellable: false,
};

describe('MyOrdersPage', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders orders with items and the total formatted as "N almuerzos"', async () => {
    vi.mocked(getOrdersV2).mockResolvedValueOnce([cancellableOrder]);

    renderPage();

    expect(await screen.findByText('Milanesa')).toBeInTheDocument();
    expect(screen.getByText(/puré/i)).toBeInTheDocument();
    expect(screen.getByText('Ensalada')).toBeInTheDocument();
    expect(screen.getByText('4 almuerzos')).toBeInTheDocument();
    expect(screen.queryByText(/créditos?\b/i)).not.toBeInTheDocument();
  });

  it('offers the cancel action only when the backend reports cancellable: true', async () => {
    vi.mocked(getOrdersV2).mockResolvedValueOnce([cancellableOrder, nonCancellableOrder]);

    renderPage();

    const cards = await screen.findAllByTestId('order-card');
    expect(cards).toHaveLength(2);
    expect(within(cards[0]).getByRole('button', { name: /cancelar pedido/i })).toBeInTheDocument();
    expect(within(cards[1]).queryByRole('button', { name: /cancelar pedido/i })).not.toBeInTheDocument();
  });

  it('cancels the order through DELETE /api/v2/orders/{id} and refreshes the list', async () => {
    vi.mocked(getOrdersV2)
      .mockResolvedValueOnce([cancellableOrder])
      .mockResolvedValueOnce([{ ...cancellableOrder, estado: 'CANCELADO', cancellable: false }]);
    vi.mocked(cancelOrderV2).mockResolvedValueOnce(undefined);

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /cancelar pedido/i }));
    fireEvent.click(await screen.findByRole('button', { name: /sí, cancelar/i }));

    // TanStack Query invoca la mutationFn con (variables, context), así que
    // afirmamos sobre el primer argumento y no sobre la lista completa.
    await waitFor(() => expect(vi.mocked(cancelOrderV2).mock.calls[0]?.[0]).toBe(123));
    await waitFor(() => expect(getOrdersV2).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('Cancelado')).toBeInTheDocument();
  });

  it('shows a cancelled order as cancelled, without a cancel action', async () => {
    vi.mocked(getOrdersV2).mockResolvedValueOnce([cancelledOrder]);

    renderPage();

    expect(await screen.findByText('Cancelado')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /cancelar pedido/i })).not.toBeInTheDocument();
  });

  it('shows an empty state pointing to ordering when there are no orders', async () => {
    vi.mocked(getOrdersV2).mockResolvedValueOnce([]);

    renderPage();

    expect(await screen.findByText(/todavía no hiciste ningún pedido/i)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /hacer mi primer pedido/i });
    expect(link).toHaveAttribute('href', '/orders/today');
  });
});
