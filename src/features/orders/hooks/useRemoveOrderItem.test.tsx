import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { useRemoveOrderItem } from './useRemoveOrderItem';
import { OrderNotModifiableError, removeOrderItemV2 } from '../services/ordersApi';
import type { OrderItemV2, OrderV2 } from '../services/ordersApi';

vi.mock('../services/ordersApi', async () => {
  const actual = await vi.importActual<typeof import('../services/ordersApi')>('../services/ordersApi');
  return {
    ...actual,
    removeOrderItemV2: vi.fn(),
  };
});

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

function makeOrder(overrides: Partial<OrderV2> = {}): OrderV2 {
  return {
    id: 900,
    fecha: '2026-06-01',
    pickupAt: '2026-06-01T15:00:00Z',
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
    ],
    cancellable: true,
    modifiable: true,
    pickupTimeChangeable: true,
    paidWithMercadoPago: false,
    creditsFromBalance: 0,
    ...overrides,
  };
}

function makeItem(overrides: Partial<OrderItemV2> = {}): OrderItemV2 {
  return {
    id: 1,
    dishId: 20,
    dishNombre: 'Ensalada',
    dishCategoria: 'Básico',
    sideId: null,
    sideNombre: null,
    creditCost: 1,
    notas: null,
    ...overrides,
  };
}

// F16: `useRemoveOrderItem` — mismo patrón que `useCancelOrder`. Cubre el
// toast "Pedido cancelado" cuando el backend cancela el pedido entero (era
// el último plato), el mensaje de `OrderNotModifiableError` mostrado dentro
// de la hoja, y el fallback genérico para cualquier otro error.
describe('useRemoveOrderItem', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows the "Pedido cancelado" toast when the backend returns estado CANCELADO (last item)', async () => {
    const order = makeOrder();
    const item = makeItem();
    vi.mocked(removeOrderItemV2).mockResolvedValueOnce({ ...order, estado: 'CANCELADO', items: [] });

    const { result } = renderHook(() => useRemoveOrderItem(), { wrapper });

    act(() => result.current.requestRemoveItem(order, item));
    act(() => result.current.confirmRemoveItem());

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Pedido cancelado'));
    expect(result.current.removeTarget).toBeNull();
    expect(result.current.removeError).toBeNull();
  });

  it('shows the item-removed toast, not "Pedido cancelado", when the order survives', async () => {
    const order = makeOrder({ items: [makeItem(), makeItem({ id: 2, dishNombre: 'Tarta' })] });
    const item = order.items[0];
    vi.mocked(removeOrderItemV2).mockResolvedValueOnce({
      ...order,
      items: [order.items[1]],
    });

    const { result } = renderHook(() => useRemoveOrderItem(), { wrapper });

    act(() => result.current.requestRemoveItem(order, item));
    act(() => result.current.confirmRemoveItem());

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Quitamos Ensalada'));
  });

  it('omits the refund phrase when the removed dish cost 0 lunches', async () => {
    const free = makeItem({ id: 2, dishNombre: 'Agua', creditCost: 0 });
    const order = makeOrder({ items: [makeItem(), free] });
    vi.mocked(removeOrderItemV2).mockResolvedValueOnce({ ...order, items: [order.items[0]] });
    const onNotice = vi.fn();

    const { result } = renderHook(() => useRemoveOrderItem({ onNotice }), { wrapper });

    act(() => result.current.requestRemoveItem(order, free));
    act(() => result.current.confirmRemoveItem());

    await waitFor(() => expect(onNotice).toHaveBeenCalled());
    const text = onNotice.mock.calls[0][0].text as string;
    expect(text).toBe('Agua ya no está en tu pedido.');
    expect(text).not.toMatch(/0 almuerzos|volvi/);
  });

  it('shows the OrderNotModifiableError message inside the sheet, without a toast, and keeps the sheet open', async () => {
    const order = makeOrder();
    const item = makeItem();
    vi.mocked(removeOrderItemV2).mockRejectedValueOnce(new OrderNotModifiableError());

    const { result } = renderHook(() => useRemoveOrderItem(), { wrapper });

    act(() => result.current.requestRemoveItem(order, item));
    act(() => result.current.confirmRemoveItem());

    await waitFor(() =>
      expect(result.current.removeError).toBe('Tu pedido ya no se puede modificar; armá uno nuevo.'),
    );
    expect(result.current.removeTarget).not.toBeNull();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('falls back to a generic error message for any other error', async () => {
    const order = makeOrder();
    const item = makeItem();
    vi.mocked(removeOrderItemV2).mockRejectedValueOnce(new Error('network error'));

    const { result } = renderHook(() => useRemoveOrderItem(), { wrapper });

    act(() => result.current.requestRemoveItem(order, item));
    act(() => result.current.confirmRemoveItem());

    await waitFor(() => expect(result.current.removeError).toBe('No pudimos quitar el plato.'));
    expect(result.current.removeTarget).not.toBeNull();
    expect(toast.success).not.toHaveBeenCalled();
  });
});

describe('useRemoveOrderItem — inline notice (F29)', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('tells a removed dish to the page, with the lunch that went back, instead of a toast', async () => {
    const order = makeOrder({ items: [makeItem(), makeItem({ id: 2, dishNombre: 'Tarta' })] });
    vi.mocked(removeOrderItemV2).mockResolvedValueOnce({ ...order, items: [order.items[1]] });
    const onNotice = vi.fn();
    const { result } = renderHook(() => useRemoveOrderItem({ onNotice }), { wrapper });

    act(() => result.current.requestRemoveItem(order, order.items[0]));
    act(() => result.current.confirmRemoveItem());

    await waitFor(() => expect(onNotice).toHaveBeenCalled());
    expect(onNotice).toHaveBeenCalledWith(
      { title: 'Plato quitado', text: 'Ensalada ya no está en tu pedido. 1 almuerzo volvió a tu saldo.' },
      { order, orderCancelled: false },
    );
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('tells the page the whole order was cancelled when the last dish goes', async () => {
    const order = makeOrder({ creditTotal: 2, items: [makeItem({ creditCost: 2 })] });
    vi.mocked(removeOrderItemV2).mockResolvedValueOnce({ ...order, estado: 'CANCELADO', items: [] });
    const onNotice = vi.fn();
    const { result } = renderHook(() => useRemoveOrderItem({ onNotice }), { wrapper });

    act(() => result.current.requestRemoveItem(order, order.items[0]));
    act(() => result.current.confirmRemoveItem());

    await waitFor(() => expect(onNotice).toHaveBeenCalled());
    expect(onNotice).toHaveBeenCalledWith(
      {
        title: 'Pedido cancelado',
        text: 'Quitaste el único plato y se canceló el pedido. 2 almuerzos volvieron a tu saldo.',
      },
      { order, orderCancelled: true },
    );
    expect(toast.success).not.toHaveBeenCalled();
  });
});
