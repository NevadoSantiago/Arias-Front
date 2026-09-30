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

    expect(toast.success).toHaveBeenCalledWith(
      'Pedido cancelado · 1 almuerzo volvió a tu saldo. Si ya pagaste con Mercado Pago, te acreditamos lo que pagaste en tu saldo cuando se confirme el pago.',
    );
  });

  it('does not claim any lunch came back when an order awaiting payment reserved none', async () => {
    await cancel({ ...order, estado: 'PENDIENTE_PAGO', paidWithMercadoPago: true });

    expect(toast.success).toHaveBeenCalledWith(
      'Pedido cancelado. Si ya pagaste con Mercado Pago, te acreditamos lo que pagaste en tu saldo cuando se confirme el pago.',
    );
  });
});

describe('useCancelOrder — pending purchases (D6)', () => {
  afterEach(() => vi.clearAllMocks());

  it('refreshes the pending Mercado Pago payments once the order is cancelled', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    vi.mocked(cancelOrderV2).mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useCancelOrder(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    });

    act(() => result.current.requestCancel({ ...order, estado: 'PENDIENTE_PAGO', paidWithMercadoPago: true }));
    act(() => result.current.confirmCancel());
    await waitFor(() => expect(toast.success).toHaveBeenCalled());

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['creditsPendingPurchases'] });
  });
});

describe('useCancelOrder — inline notice (F29)', () => {
  afterEach(() => vi.clearAllMocks());

  async function cancelWithNotice(target: OrderV2) {
    const onNotice = vi.fn();
    vi.mocked(cancelOrderV2).mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useCancelOrder({ onNotice }), { wrapper });
    act(() => result.current.requestCancel(target));
    act(() => result.current.confirmCancel());
    await waitFor(() => expect(onNotice).toHaveBeenCalled());
    return onNotice;
  }

  it('hands the message to the page instead of showing a toast', async () => {
    const onNotice = await cancelWithNotice(order);

    expect(onNotice).toHaveBeenCalledWith({ title: 'Pedido cancelado', text: '2 almuerzos volvieron a tu saldo.' }, order);
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('says no lunch was used when nothing was reserved from the balance', async () => {
    const paid = { ...order, creditTotal: 1, estado: 'PENDIENTE_PAGO' as const, paidWithMercadoPago: true };
    const onNotice = await cancelWithNotice(paid);

    expect(onNotice.mock.calls[0][0].text).toMatch(/^Si ya pagaste con Mercado Pago/);
  });

  it('keeps the toast when the page gives no listener', async () => {
    await cancel(order);

    expect(toast.success).toHaveBeenCalled();
  });
});
