import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { cancelOrderV2, getOrdersV2, OrderCancelError, type OrderV2 } from '../services/ordersApi';
import { useCancelOrder } from './useCancelOrder';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../services/ordersApi', () => ({
  cancelOrderV2: vi.fn(),
  getOrdersV2: vi.fn(),
  OrderCancelError: class OrderCancelError extends Error {},
}));

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

/** What `GET /orders` says about the order once the DELETE (204, no body) went through. */
function serverSays(target: OrderV2, cancelRefunded: boolean | null | undefined) {
  vi.mocked(getOrdersV2).mockResolvedValue([{ ...target, estado: 'CANCELADO', cancelRefunded }]);
}

async function cancel(target: OrderV2, cancelRefunded: boolean | null | undefined = true) {
  serverSays(target, cancelRefunded);
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

describe('useCancelOrder — late cancellation', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  // pickup 13:00 BA (16:00Z), refundable until 12:40 BA (15:40Z)
  const withWindow: OrderV2 = { ...order, pickupAt: '2026-09-24T16:00:00Z', refundableUntil: '2026-09-24T15:40:00Z' };

  async function cancelAt(now: string, target: OrderV2, cancelRefunded: boolean | null | undefined) {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(now));
    serverSays(target, cancelRefunded);
    const onNotice = vi.fn();
    vi.mocked(cancelOrderV2).mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useCancelOrder({ onNotice }), { wrapper });
    act(() => result.current.requestCancel(target));
    act(() => result.current.confirmCancel());
    await waitFor(() => expect(onNotice).toHaveBeenCalled());
    return onNotice;
  }

  it('says the lunches were charged anyway when confirmed past the refund deadline', async () => {
    const onNotice = await cancelAt('2026-09-24T15:45:00Z', withWindow, false);

    expect(onNotice.mock.calls[0][0]).toEqual({
      title: 'Pedido cancelado',
      text: 'Ya había pasado el límite de las 12:40, así que los 2 almuerzos se cobraron igual.',
      tone: 'warning',
    });
  });

  it('uses the singular for one lunch', async () => {
    const onNotice = await cancelAt('2026-09-24T15:45:00Z', { ...withWindow, creditTotal: 1 }, false);

    expect(onNotice.mock.calls[0][0].text).toBe('Ya había pasado el límite de las 12:40, así que el almuerzo se cobró igual.');
  });

  it('keeps the refund message when confirmed before the deadline', async () => {
    const onNotice = await cancelAt('2026-09-24T15:30:00Z', withWindow, true);

    expect(onNotice.mock.calls[0][0]).toEqual({ title: 'Pedido cancelado', text: '2 almuerzos volvieron a tu saldo.' });
  });

  it('toasts the late outcome when the page gives no listener', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-24T15:45:00Z'));
    await cancel(withWindow, false);

    expect(toast.success).toHaveBeenCalledWith('Pedido cancelado · 2 almuerzos consumidos');
  });

  it('trusts the backend over the device clock: clock says late, server says refunded', async () => {
    const onNotice = await cancelAt('2026-09-24T15:45:00Z', withWindow, true);

    expect(onNotice.mock.calls[0][0]).toEqual({ title: 'Pedido cancelado', text: '2 almuerzos volvieron a tu saldo.' });
  });

  it('trusts the backend over the device clock: clock says on time, server says charged', async () => {
    const onNotice = await cancelAt('2026-09-24T15:30:00Z', withWindow, false);

    expect(onNotice.mock.calls[0][0]).toEqual({
      title: 'Pedido cancelado',
      text: 'Ya había pasado el límite de las 12:40, así que los 2 almuerzos se cobraron igual.',
      tone: 'warning',
    });
  });

  it('claims neither refund nor charge when the server does not say (null)', async () => {
    const onNotice = await cancelAt('2026-09-24T15:45:00Z', withWindow, null);

    expect(onNotice.mock.calls[0][0].text).not.toMatch(/cobraron|volvieron|volvió|devuelt/);
    expect(onNotice.mock.calls[0][0].tone).toBeUndefined();
  });

  it('falls back to a neutral notice when the order cannot be read back', async () => {
    vi.mocked(getOrdersV2).mockRejectedValue(new Error('network'));
    vi.mocked(cancelOrderV2).mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useCancelOrder(), { wrapper });
    act(() => result.current.requestCancel(withWindow));
    act(() => result.current.confirmCancel());
    await waitFor(() => expect(toast.success).toHaveBeenCalled());

    expect(toast.success).toHaveBeenCalledWith('Pedido cancelado');
  });

  it('shows the backend message when the order is from a previous day', async () => {
    vi.mocked(cancelOrderV2).mockRejectedValueOnce(
      new OrderCancelError('El pedido es de un día anterior y ya no se puede cancelar'),
    );
    const { result } = renderHook(() => useCancelOrder(), { wrapper });
    act(() => result.current.requestCancel(order));
    act(() => result.current.confirmCancel());

    await waitFor(() =>
      expect(result.current.cancelError).toBe('El pedido es de un día anterior y ya no se puede cancelar'),
    );
  });

  it('keeps the generic message for any other failure', async () => {
    vi.mocked(cancelOrderV2).mockRejectedValueOnce(new Error('Error de red'));
    const { result } = renderHook(() => useCancelOrder(), { wrapper });
    act(() => result.current.requestCancel(order));
    act(() => result.current.confirmCancel());

    await waitFor(() => expect(result.current.cancelError).toBe('No pudimos cancelar el pedido.'));
  });
});

describe('useCancelOrder — pending purchases (D6)', () => {
  afterEach(() => vi.clearAllMocks());

  it('refreshes the pending Mercado Pago payments once the order is cancelled', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    serverSays({ ...order, estado: 'PENDIENTE_PAGO', paidWithMercadoPago: true }, true);
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
    serverSays(target, true);
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
