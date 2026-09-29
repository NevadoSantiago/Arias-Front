import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { cancelOrderV2, type OrderV2 } from '../services/ordersApi';
import { useCancelOrder } from './useCancelOrder';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../services/ordersApi', () => ({ cancelOrderV2: vi.fn() }));

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const order: OrderV2 = {
  id: 9,
  fecha: '2026-09-24',
  pickupAt: '2026-09-24T16:00:00Z',
  estado: 'PENDIENTE',
  creditTotal: 2,
  notas: null,
  items: [],
  cancellable: true,
  modifiable: true,
  pickupTimeChangeable: true,
  paidWithMercadoPago: false,
  creditsFromBalance: 0,
};

async function cancel(target: OrderV2) {
  vi.mocked(cancelOrderV2).mockResolvedValueOnce(undefined);
  const { result } = renderHook(() => useCancelOrder(), { wrapper });
  act(() => result.current.requestCancel(target));
  act(() => result.current.confirmCancel());
  await waitFor(() => expect(toast.success).toHaveBeenCalled());
}

describe('useCancelOrder — success toast', () => {
  afterEach(() => vi.clearAllMocks());

  it('counts every lunch of a scheduled order as back in the balance', async () => {
    await cancel(order);

    expect(toast.success).toHaveBeenCalledWith('Pedido cancelado · 2 almuerzos volvieron a tu saldo');
  });

  it('counts only the reserved lunches of an order awaiting payment with a partial balance (F23)', async () => {
    await cancel({ ...order, estado: 'PENDIENTE_PAGO', paidWithMercadoPago: true, creditsFromBalance: 1 });

    expect(toast.success).toHaveBeenCalledWith('Pedido cancelado · 1 almuerzo volvió a tu saldo');
  });

  it('does not claim any lunch came back when an order awaiting payment reserved none', async () => {
    await cancel({ ...order, estado: 'PENDIENTE_PAGO', paidWithMercadoPago: true });

    expect(toast.success).toHaveBeenCalledWith('Pedido cancelado');
  });
});
